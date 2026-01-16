/**
 * Self-Probe (Keep-Alive) 服務
 * 定期檢查服務狀態，防止因長時間閒置被系統回收
 */

import { logger } from './logger.js';
import { getSelfProbeSettings, saveSelfProbeSettings } from './database.js';
import type { Config, SelfProbeStats, SelfProbeSettingsRequest } from '../types/index.js';

export interface SelfProbeContext {
  getSocketIOConnectionCount: () => number;
  getMCPServerStatus: () => { running: boolean } | undefined;
  getSessionCount: () => number;
  cleanupExpiredSessions: () => void;
}

export class SelfProbeService {
  private timer: NodeJS.Timeout | null = null;
  private lastProbeTime: Date | null = null;
  private probeCount: number = 0;
  private enabled: boolean = false;
  private intervalSeconds: number = 300;
  private context: SelfProbeContext | null = null;

  constructor(private config: Config) {
    this.enabled = config.enableSelfProbe ?? false;
    this.intervalSeconds = config.selfProbeIntervalSeconds ?? 300;
  }

  setContext(context: SelfProbeContext): void {
    this.context = context;
  }

  start(): void {
    if (this.timer) {
      this.stop();
    }

    const dbSettings = getSelfProbeSettings();
    if (dbSettings) {
      this.enabled = dbSettings.enabled;
      this.intervalSeconds = dbSettings.intervalSeconds;
    }

    if (!this.enabled) {
      logger.debug('Self-probe is disabled, not starting');
      return;
    }

    const intervalMs = this.intervalSeconds * 1000;
    this.timer = setInterval(() => this.probe(), intervalMs);
    logger.info(`Self-probe started with interval: ${this.intervalSeconds}s`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Self-probe stopped');
    }
  }

  restart(): void {
    this.stop();
    this.start();
  }

  updateSettings(settings: SelfProbeSettingsRequest): void {
    if (settings.enabled !== undefined) {
      this.enabled = settings.enabled;
    }
    if (settings.intervalSeconds !== undefined) {
      if (settings.intervalSeconds < 60 || settings.intervalSeconds > 600) {
        throw new Error('Interval must be between 60 and 600 seconds');
      }
      this.intervalSeconds = settings.intervalSeconds;
    }

    saveSelfProbeSettings(settings);

    if (this.enabled) {
      this.restart();
    } else {
      this.stop();
    }
  }

  private async probe(): Promise<void> {
    this.lastProbeTime = new Date();
    this.probeCount++;

    try {
      if (this.context) {
        this.checkSocketIO();
        this.checkMCPStatus();
        this.triggerSessionCleanup();
      }

      logger.debug(`Self-probe #${this.probeCount} completed`);
    } catch (error) {
      logger.warn('Self-probe encountered an issue:', error);
    }
  }

  private checkSocketIO(): void {
    if (!this.context) return;

    const connectedSockets = this.context.getSocketIOConnectionCount();
    logger.debug(`Self-probe: Socket.IO connected clients: ${connectedSockets}`);
  }

  private checkMCPStatus(): void {
    if (!this.context) return;

    const mcpStatus = this.context.getMCPServerStatus();
    logger.debug(`Self-probe: MCP Server running: ${mcpStatus?.running ?? 'N/A'}`);
  }

  private triggerSessionCleanup(): void {
    if (!this.context) return;

    const sessionCount = this.context.getSessionCount();
    if (sessionCount > 0) {
      this.context.cleanupExpiredSessions();
      logger.debug(`Self-probe: Triggered session cleanup, active sessions: ${sessionCount}`);
    }
  }

  getStats(): SelfProbeStats {
    return {
      enabled: this.enabled,
      intervalSeconds: this.intervalSeconds,
      lastProbeTime: this.lastProbeTime,
      probeCount: this.probeCount,
      isRunning: this.timer !== null
    };
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  getProbeCount(): number {
    return this.probeCount;
  }

  getLastProbeTime(): Date | null {
    return this.lastProbeTime;
  }
}
