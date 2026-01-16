/**
 * Health Monitor for Worker Process
 */

import { EventEmitter } from 'events';
import { IPCBridge } from './ipc-bridge.js';
import { IPC_METHODS, SUPERVISOR_DEFAULTS } from '../shared/ipc-constants.js';
import type { HealthCheckResponse, HealthStatus } from '../shared/ipc-types.js';

export interface HealthMonitorConfig {
  checkIntervalMs: number;
  checkTimeoutMs: number;
  consecutiveFailuresBeforeRestart: number;
}

export interface HealthState {
  status: HealthStatus;
  lastCheckTime: Date | null;
  consecutiveFailures: number;
  lastSuccessTime: Date | null;
  lastResponse: HealthCheckResponse | null;
}

export class HealthMonitor extends EventEmitter {
  private config: HealthMonitorConfig;
  private ipcBridge: IPCBridge;
  private checkInterval: NodeJS.Timeout | null = null;
  private state: HealthState;

  constructor(ipcBridge: IPCBridge, config?: Partial<HealthMonitorConfig>) {
    super();
    this.ipcBridge = ipcBridge;
    this.config = {
      checkIntervalMs: config?.checkIntervalMs ?? SUPERVISOR_DEFAULTS.HEALTH_CHECK_INTERVAL_MS,
      checkTimeoutMs: config?.checkTimeoutMs ?? SUPERVISOR_DEFAULTS.HEALTH_CHECK_TIMEOUT_MS,
      consecutiveFailuresBeforeRestart: config?.consecutiveFailuresBeforeRestart ?? SUPERVISOR_DEFAULTS.CONSECUTIVE_FAILURES_BEFORE_RESTART,
    };
    this.state = {
      status: 'not_running',
      lastCheckTime: null,
      consecutiveFailures: 0,
      lastSuccessTime: null,
      lastResponse: null,
    };
  }

  /**
   * Start periodic health checks
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    this.checkInterval = setInterval(() => {
      this.performCheck();
    }, this.config.checkIntervalMs);

    // Perform initial check immediately
    this.performCheck();
  }

  /**
   * Stop health checks
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current health state
   */
  getState(): HealthState {
    return { ...this.state };
  }

  /**
   * Reset health state (called when worker is restarted)
   */
  reset(): void {
    this.state = {
      status: 'not_running',
      lastCheckTime: null,
      consecutiveFailures: 0,
      lastSuccessTime: null,
      lastResponse: null,
    };
  }

  /**
   * Mark worker as starting
   */
  markStarting(): void {
    this.state.status = 'not_running';
    this.state.consecutiveFailures = 0;
  }

  /**
   * Perform a single health check
   */
  async performCheck(): Promise<HealthCheckResponse | null> {
    if (!this.ipcBridge.isConnected()) {
      this.handleFailure('Worker not connected');
      return null;
    }

    this.state.lastCheckTime = new Date();

    try {
      const response = await Promise.race([
        this.ipcBridge.request(IPC_METHODS.HEALTH_CHECK, {}) as Promise<HealthCheckResponse>,
        this.createTimeout(),
      ]);

      if (response) {
        this.handleSuccess(response);
        return response;
      } else {
        this.handleFailure('Health check timeout');
        return null;
      }
    } catch (error) {
      this.handleFailure(error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  private createTimeout(): Promise<null> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), this.config.checkTimeoutMs);
    });
  }

  private handleSuccess(response: HealthCheckResponse): void {
    this.state.status = response.status;
    this.state.consecutiveFailures = 0;
    this.state.lastSuccessTime = new Date();
    this.state.lastResponse = response;

    this.emit('health:ok', response);
  }

  private handleFailure(reason: string): void {
    this.state.consecutiveFailures++;
    this.state.status = 'error';

    this.emit('health:failed', {
      reason,
      consecutiveFailures: this.state.consecutiveFailures,
    });

    if (this.state.consecutiveFailures >= this.config.consecutiveFailuresBeforeRestart) {
      this.emit('health:restart-needed', {
        reason,
        consecutiveFailures: this.state.consecutiveFailures,
      });
    }
  }

  /**
   * Check if worker needs restart based on health state
   */
  needsRestart(): boolean {
    return this.state.consecutiveFailures >= this.config.consecutiveFailuresBeforeRestart;
  }

  /**
   * Get time since last successful health check
   */
  getTimeSinceLastSuccess(): number | null {
    if (!this.state.lastSuccessTime) {
      return null;
    }
    return Date.now() - this.state.lastSuccessTime.getTime();
  }
}
