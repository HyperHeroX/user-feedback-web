/**
 * Supervisor Service - Manages Worker Process Lifecycle
 */

import { EventEmitter } from 'events';
import { fork, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { IPCBridge } from './ipc-bridge.js';
import { HealthMonitor } from './health-monitor.js';
import { IPC_METHODS, SUPERVISOR_DEFAULTS } from '../shared/ipc-constants.js';
import type {
  WorkerState,
  WorkerStatus,
  SelfTestResult,
  SelfTestHealthInfo,
  AutoRepairInfo,
  DiagnosticsInfo,
  HealthCheckResponse,
} from '../shared/ipc-types.js';
import type { SupervisorConfig } from '../types/index.js';

export interface SupervisorServiceConfig extends SupervisorConfig {
  workerScript: string;
  workerArgs?: string[];
}

interface RestartHistoryEntry {
  timestamp: string;
  reason: string;
}

export class SupervisorService extends EventEmitter {
  private config: SupervisorServiceConfig;
  private worker: ChildProcess | null = null;
  private ipcBridge: IPCBridge;
  private healthMonitor: HealthMonitor;
  private state: WorkerState;
  private startTime: Date;
  private restartHistory: RestartHistoryEntry[] = [];
  private isShuttingDown = false;
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();

  constructor(config: SupervisorServiceConfig) {
    super();
    this.config = config;
    this.startTime = new Date();
    this.state = {
      pid: null,
      status: 'stopped',
      restartCount: 0,
      lastHealthCheck: null,
      lastCrash: null,
      startTime: null,
    };

    this.ipcBridge = new IPCBridge(SUPERVISOR_DEFAULTS.REQUEST_TIMEOUT_MS);
    this.healthMonitor = new HealthMonitor(this.ipcBridge, {
      checkIntervalMs: config.healthCheckIntervalMs,
      checkTimeoutMs: config.healthCheckTimeoutMs,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.ipcBridge.on('worker:event', (event) => {
      this.handleWorkerEvent(event);
    });

    this.ipcBridge.on('worker:exit', ({ code, signal }) => {
      this.handleWorkerExit(code, signal);
    });

    this.ipcBridge.on('worker:error', (error) => {
      this.emit('worker:error', error);
    });

    this.healthMonitor.on('health:ok', (response) => {
      this.state.lastHealthCheck = new Date();
      this.emit('health:ok', response);
    });

    this.healthMonitor.on('health:restart-needed', ({ reason }) => {
      if (!this.isShuttingDown) {
        this.scheduleRestart(reason);
      }
    });
  }

  /**
   * Start the supervisor and spawn worker
   */
  async start(): Promise<void> {
    if (this.state.status === 'running') {
      return;
    }

    await this.spawnWorker();
  }

  /**
   * Stop the supervisor and worker
   */
  async stop(): Promise<void> {
    this.isShuttingDown = true;
    this.healthMonitor.stop();

    if (this.worker) {
      await this.gracefulShutdown();
    }

    this.state.status = 'stopped';
  }

  /**
   * Restart the worker process
   */
  async restart(reason: string = 'Manual restart'): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const previousPid = this.state.pid;
    
    await this.killWorker();
    await this.spawnWorker();

    this.restartHistory.push({
      timestamp: new Date().toISOString(),
      reason,
    });

    // Keep only last 10 restarts
    if (this.restartHistory.length > 10) {
      this.restartHistory = this.restartHistory.slice(-10);
    }

    this.emit('worker:restarted', { previousPid, newPid: this.state.pid, reason });
  }

  /**
   * Get current worker state
   */
  getState(): WorkerState {
    return { ...this.state };
  }

  /**
   * Get supervisor uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Get worker uptime in milliseconds
   */
  getWorkerUptime(): number | null {
    if (!this.state.startTime) {
      return null;
    }
    return Date.now() - this.state.startTime.getTime();
  }

  /**
   * Send MCP tool request to worker
   */
  async sendMCPToolRequest(toolName: string, params: unknown): Promise<unknown> {
    if (!this.isWorkerHealthy()) {
      throw new Error('Worker is not healthy');
    }

    return this.ipcBridge.request(IPC_METHODS.MCP_TOOL, { toolName, params });
  }

  /**
   * Execute self-test with auto-repair
   */
  async selfTest(): Promise<SelfTestResult> {
    const timestamp = new Date().toISOString();
    let autoRepair: AutoRepairInfo | undefined;

    // Check and auto-repair worker if needed
    if (!this.isWorkerHealthy()) {
      const previousPid = this.state.pid;
      const reason = this.state.status === 'crashed' 
        ? 'Worker crashed' 
        : 'Worker not healthy';

      if (this.state.restartCount < this.config.maxRestartAttempts) {
        await this.restart(reason);
        
        autoRepair = {
          action: 'worker_restarted',
          previousPid,
          newPid: this.state.pid!,
          reason,
        };
      }
    }

    // Perform health check
    const healthResponse = await this.healthMonitor.performCheck();
    const health = this.buildHealthInfo(healthResponse);
    const diagnostics = this.buildDiagnosticsInfo();
    const success = health.worker.status === 'ok' || health.worker.status === 'restarted';
    const summary = this.buildSummary(health, autoRepair);

    return {
      success,
      timestamp,
      health,
      autoRepair,
      diagnostics,
      summary,
    };
  }

  private buildHealthInfo(healthResponse: HealthCheckResponse | null): SelfTestHealthInfo {
    const workerStatus = autoRepairWasPerformed => {
      if (autoRepairWasPerformed) return 'restarted';
      if (this.state.status === 'running' && healthResponse?.status === 'ok') return 'ok';
      if (this.state.restartCount >= this.config.maxRestartAttempts) return 'failed';
      return 'error';
    };

    return {
      supervisor: {
        status: 'ok',
        pid: process.pid,
        uptime: this.getUptime(),
        memoryUsage: process.memoryUsage(),
      },
      worker: {
        status: workerStatus(false) as 'ok' | 'restarted' | 'failed' | 'error' | 'not_running',
        pid: this.state.pid,
        uptime: this.getWorkerUptime(),
        restartCount: this.state.restartCount,
      },
      webServer: {
        status: healthResponse?.webServerPort ? 'ok' : 'not_running',
        port: healthResponse?.webServerPort ?? null,
        activeConnections: healthResponse?.activeConnections ?? 0,
      },
      database: {
        status: healthResponse?.databaseConnected ? 'ok' : 'error',
      },
    };
  }

  private buildDiagnosticsInfo(): DiagnosticsInfo {
    return {
      system: {
        platform: process.platform,
        nodeVersion: process.version,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
      },
      restartHistory: this.restartHistory,
    };
  }

  private buildSummary(health: SelfTestHealthInfo, autoRepair?: AutoRepairInfo): string {
    const parts: string[] = [];

    if (autoRepair) {
      parts.push(`Worker 已自動重啟 (原因: ${autoRepair.reason})`);
    }

    if (health.worker.status === 'ok') {
      parts.push('系統正常運行');
    } else if (health.worker.status === 'restarted') {
      parts.push('Worker 已恢復');
    } else if (health.worker.status === 'failed') {
      parts.push('Worker 重啟失敗，需要人工介入');
    } else {
      parts.push('Worker 狀態異常');
    }

    if (health.worker.restartCount > 0) {
      parts.push(`(重啟次數: ${health.worker.restartCount}/${this.config.maxRestartAttempts})`);
    }

    return parts.join(' ');
  }

  private isWorkerHealthy(): boolean {
    return this.state.status === 'running' && this.worker !== null && !this.worker.killed;
  }

  private async spawnWorker(): Promise<void> {
    this.state.status = 'starting';
    this.emit('worker:starting');

    const workerPath = this.config.workerScript;
    const workerArgs = this.config.workerArgs || [];

    this.worker = fork(workerPath, workerArgs, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        ...process.env,
        IS_WORKER_PROCESS: 'true',
      },
    });

    this.state.pid = this.worker.pid ?? null;
    this.state.startTime = new Date();

    this.ipcBridge.attach(this.worker);

    // Wait for ready event with timeout
    try {
      await this.waitForReady(10000);
      this.state.status = 'running';
      this.healthMonitor.reset();
      this.healthMonitor.start();
      this.emit('worker:ready', { pid: this.state.pid });
    } catch (error) {
      this.state.status = 'crashed';
      throw error;
    }
  }

  private waitForReady(timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Worker startup timeout'));
      }, timeout);

      const handler = (event: { method: string }) => {
        if (event.method === IPC_METHODS.READY) {
          clearTimeout(timer);
          this.ipcBridge.off('worker:event', handler);
          resolve();
        }
      };

      this.ipcBridge.on('worker:event', handler);
    });
  }

  private async killWorker(): Promise<void> {
    if (!this.worker) {
      return;
    }

    this.healthMonitor.stop();
    this.ipcBridge.detach();

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.worker && !this.worker.killed) {
          this.worker.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.worker!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.worker!.kill('SIGTERM');
    });
  }

  private async gracefulShutdown(): Promise<void> {
    if (!this.worker || !this.ipcBridge.isConnected()) {
      return;
    }

    try {
      await this.ipcBridge.request(IPC_METHODS.SHUTDOWN, { graceful: true });
    } catch {
      // Ignore errors during shutdown
    }

    await this.killWorker();
  }

  private handleWorkerEvent(event: { method: string; params?: unknown }): void {
    if (event.method === IPC_METHODS.READY) {
      this.emit('worker:ready', event.params);
    } else if (event.method === IPC_METHODS.ERROR) {
      this.emit('worker:error', event.params);
    }
  }

  private handleWorkerExit(code: number | null, signal: string | null): void {
    const wasRunning = this.state.status === 'running';

    this.state.status = 'crashed';
    this.state.lastCrash = new Date();
    this.worker = null;

    this.emit('worker:exited', { code, signal, wasRunning });

    if (wasRunning && !this.isShuttingDown) {
      this.scheduleRestart(`Worker exited with code ${code}, signal ${signal}`);
    }
  }

  private scheduleRestart(reason: string): void {
    if (this.state.restartCount >= this.config.maxRestartAttempts) {
      this.emit('worker:max-restarts-reached', {
        restartCount: this.state.restartCount,
        maxAttempts: this.config.maxRestartAttempts,
      });
      return;
    }

    this.state.restartCount++;

    setTimeout(() => {
      if (!this.isShuttingDown) {
        this.restart(reason).catch((error) => {
          this.emit('worker:restart-failed', error);
        });
      }
    }, this.config.restartDelayMs);
  }
}
