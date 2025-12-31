/**
 * user-feedback MCP Tools - 實例鎖定管理工具
 * 確保系統中只有一個 User Feedback 實例運行
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import path from 'path';
import { logger } from './logger.js';
import { getPackageVersion } from './version.js';
const DEFAULT_LOCK_FILENAME = '.user-feedback.lock';
const DEFAULT_HEALTH_CHECK_TIMEOUT = 3000;
export class InstanceLock {
    static lockFilePath = null;
    static getLockFilePath() {
        if (this.lockFilePath) {
            return this.lockFilePath;
        }
        const dataDir = path.resolve(process.cwd(), 'data');
        if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true });
        }
        return path.join(dataDir, DEFAULT_LOCK_FILENAME);
    }
    static setLockFilePath(filePath) {
        this.lockFilePath = filePath;
    }
    static async check(healthCheckTimeout = DEFAULT_HEALTH_CHECK_TIMEOUT) {
        const lockPath = this.getLockFilePath();
        if (!existsSync(lockPath)) {
            logger.debug('Lock file not found, no existing instance');
            return { running: false };
        }
        let lockData;
        try {
            const content = readFileSync(lockPath, 'utf-8');
            lockData = JSON.parse(content);
        }
        catch (error) {
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
    static async acquire(port) {
        const lockPath = this.getLockFilePath();
        const lockData = {
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
            const verifyData = JSON.parse(verifyContent);
            if (verifyData.pid !== process.pid) {
                logger.error('Lock file verification failed: PID mismatch');
                return false;
            }
            return true;
        }
        catch (error) {
            logger.error('Failed to acquire lock file:', error);
            return false;
        }
    }
    static async release() {
        const lockPath = this.getLockFilePath();
        if (!existsSync(lockPath)) {
            logger.debug('No lock file to release');
            return;
        }
        try {
            const content = readFileSync(lockPath, 'utf-8');
            const lockData = JSON.parse(content);
            if (lockData.pid !== process.pid) {
                logger.warn(`Lock file belongs to different process (${lockData.pid}), not releasing`);
                return;
            }
            unlinkSync(lockPath);
            logger.info('Lock file released');
        }
        catch (error) {
            logger.error('Failed to release lock file:', error);
        }
    }
    static async verifyInstance(port, timeout = DEFAULT_HEALTH_CHECK_TIMEOUT) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(`http://localhost:${port}/api/health`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                const data = await response.json();
                return data.status === 'ok';
            }
            return false;
        }
        catch (error) {
            logger.debug(`Health check failed for port ${port}:`, error);
            return false;
        }
    }
    static isProcessRunning(pid) {
        try {
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    static async cleanupStaleLock() {
        const lockPath = this.getLockFilePath();
        try {
            if (existsSync(lockPath)) {
                unlinkSync(lockPath);
                logger.info('Stale lock file cleaned up');
            }
        }
        catch (error) {
            logger.error('Failed to cleanup stale lock:', error);
        }
    }
    static async forceCleanup() {
        const lockPath = this.getLockFilePath();
        try {
            if (existsSync(lockPath)) {
                unlinkSync(lockPath);
                logger.info('Lock file forcefully removed');
            }
        }
        catch (error) {
            logger.error('Failed to force cleanup lock:', error);
        }
    }
}
//# sourceMappingURL=instance-lock.js.map