/**
 * user-feedback MCP Tools - 實例鎖定管理工具
 * 確保系統中只有一個 User Feedback 實例運行
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { getPackageVersion } from './version.js';

export interface LockFileData {
  pid: number;
  port: number;
  startTime: string;
  version: string;
}

export interface InstanceCheckResult {
  running: boolean;
  port?: number;
  pid?: number;
  lockData?: LockFileData;
}

const DEFAULT_LOCK_FILENAME = '.user-feedback.lock';
const DEFAULT_HEALTH_CHECK_TIMEOUT = 3000;

export class InstanceLock {
  private static lockFilePath: string | null = null;

  static getLockFilePath(): string {
    if (this.lockFilePath) {
      return this.lockFilePath;
    }

    const dataDir = path.resolve(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, DEFAULT_LOCK_FILENAME);
  }

  static setLockFilePath(filePath: string): void {
    this.lockFilePath = filePath;
  }

  static async check(healthCheckTimeout: number = DEFAULT_HEALTH_CHECK_TIMEOUT): Promise<InstanceCheckResult> {
    const lockPath = this.getLockFilePath();

    if (!existsSync(lockPath)) {
      logger.debug('Lock file not found, no existing instance');
      return { running: false };
    }

    let lockData: LockFileData;
    try {
      const content = readFileSync(lockPath, 'utf-8');
      lockData = JSON.parse(content) as LockFileData;
    } catch (error) {
      logger.warn('Failed to read lock file, treating as stale:', error);
      await this.cleanupStaleLock();
      return { running: false };
    }

    if (!lockData.pid || !lockData.port) {
      logger.warn('Invalid lock file data, cleaning up');
      await this.cleanupStaleLock();
      return { running: false };
    }

    if (!this.isProcessRunning(lockData.pid)) {
      logger.info(`Process ${lockData.pid} not running, cleaning up stale lock`);
      await this.cleanupStaleLock();
      return { running: false };
    }

    const isAlive = await this.verifyInstance(lockData.port, healthCheckTimeout);
    if (!isAlive) {
      logger.info(`Health check failed for port ${lockData.port}, cleaning up stale lock`);
      await this.cleanupStaleLock();
      return { running: false };
    }

    logger.info(`Found running instance: PID=${lockData.pid}, Port=${lockData.port}`);
    return {
      running: true,
      port: lockData.port,
      pid: lockData.pid,
      lockData
    };
  }

  static async acquire(port: number): Promise<boolean> {
    const lockPath = this.getLockFilePath();
    const lockData: LockFileData = {
      pid: process.pid,
      port,
      startTime: new Date().toISOString(),
      version: getPackageVersion()
    };

    try {
      const dataDir = path.dirname(lockPath);
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      writeFileSync(lockPath, JSON.stringify(lockData, null, 2), { flag: 'w' });
      logger.info(`Lock file acquired: PID=${lockData.pid}, Port=${port}`);

      const verifyContent = readFileSync(lockPath, 'utf-8');
      const verifyData = JSON.parse(verifyContent) as LockFileData;
      if (verifyData.pid !== process.pid) {
        logger.error('Lock file verification failed: PID mismatch');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to acquire lock file:', error);
      return false;
    }
  }

  static async release(): Promise<void> {
    const lockPath = this.getLockFilePath();

    if (!existsSync(lockPath)) {
      logger.debug('No lock file to release');
      return;
    }

    try {
      const content = readFileSync(lockPath, 'utf-8');
      const lockData = JSON.parse(content) as LockFileData;

      if (lockData.pid !== process.pid) {
        logger.warn(`Lock file belongs to different process (${lockData.pid}), not releasing`);
        return;
      }

      unlinkSync(lockPath);
      logger.info('Lock file released');
    } catch (error) {
      logger.error('Failed to release lock file:', error);
    }
  }

  static async verifyInstance(port: number, timeout: number = DEFAULT_HEALTH_CHECK_TIMEOUT): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`http://localhost:${port}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json() as { status: string };
        return data.status === 'ok';
      }

      return false;
    } catch (error) {
      logger.debug(`Health check failed for port ${port}:`, error);
      return false;
    }
  }

  private static isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private static async cleanupStaleLock(): Promise<void> {
    const lockPath = this.getLockFilePath();
    try {
      if (existsSync(lockPath)) {
        unlinkSync(lockPath);
        logger.info('Stale lock file cleaned up');
      }
    } catch (error) {
      logger.error('Failed to cleanup stale lock:', error);
    }
  }

  static async forceCleanup(): Promise<void> {
    const lockPath = this.getLockFilePath();
    try {
      if (existsSync(lockPath)) {
        unlinkSync(lockPath);
        logger.info('Lock file forcefully removed');
      }
    } catch (error) {
      logger.error('Failed to force cleanup lock:', error);
    }
  }
}
