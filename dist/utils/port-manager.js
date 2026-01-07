/**
 * user-feedback MCP Tools - 連接埠管理工具
 */
import { createServer } from 'net';
import { MCPError } from '../types/index.js';
import { logger } from './logger.js';
import { processManager } from './process-manager.js';
/**
 * 連接埠管理器
 */
export class PortManager {
    PORT_RANGE_START = 5000;
    PORT_RANGE_END = 5099;
    MAX_RETRIES = 20;
    /**
     * 檢查連接埠是否可用（增強版本）
     */
    async isPortAvailable(port) {
        return new Promise((resolve) => {
            const server = createServer();
            let resolved = false;
            // 設定逾時，避免長時間等待
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    server.close(() => {
                        resolve(false);
                    });
                }
            }, 1000);
            server.listen(port, () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    // 連接埠可用，立即關閉測試伺服器
                    server.close(() => {
                        resolve(true);
                    });
                }
            });
            server.on('error', (_err) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    // 連接埠不可用
                    resolve(false);
                }
            });
        });
    }
    /**
     * 深度檢查連接埠是否真正可用（包括處理程序偵測）
     */
    async isPortTrulyAvailable(port) {
        // 首先進行基礎檢查
        const basicCheck = await this.isPortAvailable(port);
        if (!basicCheck) {
            return false;
        }
        // 檢查是否有處理程序佔用該連接埠
        const processInfo = await processManager.getPortProcess(port);
        if (processInfo) {
            logger.debug(`連接埠 ${port} 被處理程序佔用:`, processInfo);
            return false;
        }
        return true;
    }
    /**
     * 智慧連接埠衝突解決
     */
    async resolvePortConflict(port) {
        logger.info(`檢查連接埠 ${port} 是否可用`);
        // 檢查連接埠是否可用
        if (await this.isPortAvailable(port)) {
            logger.info(`連接埠 ${port} 可用，直接使用`);
            return port;
        }
        // 連接埠被佔用，使用逃避策略 - 不嘗試終止現有進程
        logger.info(`連接埠 ${port} 被佔用，使用逃避策略尋找下一個可用連接埠`);
        return await this.findAlternativePort(port);
    }
    /**
     * 尋找替代連接埠
     */
    async findAlternativePort(preferredPort) {
        logger.info(`尋找連接埠 ${preferredPort} 的替代方案（最多嘗試 ${this.MAX_RETRIES} 次）`);
        // 從 preferredPort + 1 開始順序遞增嘗試
        for (let i = 1; i <= this.MAX_RETRIES; i++) {
            const port = preferredPort + i;
            if (port > 65535) {
                break;
            }
            logger.debug(`嘗試連接埠 ${port}...`);
            if (await this.isPortAvailable(port)) {
                logger.info(`找到可用連接埠: ${port}`);
                return port;
            }
            logger.debug(`連接埠 ${port} 被佔用，繼續嘗試...`);
        }
        throw new Error(`無法在 ${this.MAX_RETRIES} 次嘗試後找到可用連接埠（從 ${preferredPort + 1} 到 ${preferredPort + this.MAX_RETRIES}）`);
    }
    /**
     * 查找可用連接埠（傳統方法）
     */
    async findAvailablePort(preferredPort) {
        // 如果指定了首選連接埠，先嘗試該連接埠
        if (preferredPort) {
            logger.debug(`檢查首選連接埠: ${preferredPort}`);
            const available = await this.isPortAvailable(preferredPort);
            if (available) {
                logger.info(`使用首選連接埠: ${preferredPort}`);
                return preferredPort;
            }
            else {
                logger.warn(`首選連接埠 ${preferredPort} 不可用，尋找其他連接埠...`);
            }
        }
        // 在連接埠範圍內查找可用連接埠
        for (let port = this.PORT_RANGE_START; port <= this.PORT_RANGE_END; port++) {
            logger.debug(`檢查連接埠: ${port}`);
            if (await this.isPortAvailable(port)) {
                logger.info(`找到可用連接埠: ${port}`);
                return port;
            }
        }
        // 如果範圍內沒有可用連接埠，隨機嘗試
        for (let i = 0; i < this.MAX_RETRIES; i++) {
            const randomPort = Math.floor(Math.random() * (65535 - 1024) + 1024);
            logger.debug(`嘗試隨機連接埠: ${randomPort}`);
            if (await this.isPortAvailable(randomPort)) {
                logger.info(`找到隨機可用連接埠: ${randomPort}`);
                return randomPort;
            }
        }
        throw new MCPError('No available ports found', 'NO_AVAILABLE_PORTS', {
            preferredPort,
            rangeStart: this.PORT_RANGE_START,
            rangeEnd: this.PORT_RANGE_END,
            maxRetries: this.MAX_RETRIES
        });
    }
    /**
     * 取得連接埠資訊
     */
    async getPortInfo(port) {
        const available = await this.isPortAvailable(port);
        let pid;
        if (!available) {
            const processInfo = await processManager.getPortProcess(port);
            pid = processInfo?.pid;
        }
        return {
            port,
            available,
            pid
        };
    }
    /**
     * 取得連接埠範圍內的所有連接埠狀態
     */
    async getPortRangeStatus() {
        const results = [];
        for (let port = this.PORT_RANGE_START; port <= this.PORT_RANGE_END; port++) {
            const info = await this.getPortInfo(port);
            results.push(info);
        }
        return results;
    }
    /**
     * 清理僵屍處理程序（跨平台實作）
     */
    async cleanupZombieProcesses() {
        logger.info('開始清理僵屍處理程序...');
        try {
            let cleanedCount = 0;
            for (let port = this.PORT_RANGE_START; port <= this.PORT_RANGE_END; port++) {
                const processInfo = await processManager.getPortProcess(port);
                if (processInfo && processManager.isOwnProcess(processInfo)) {
                    logger.info(`發現僵屍處理程序: PID ${processInfo.pid} 佔用連接埠 ${port}`);
                    const killed = await processManager.killProcess(processInfo.pid, true);
                    if (killed) {
                        cleanedCount++;
                        logger.info(`已清理僵屍處理程序: PID ${processInfo.pid}`);
                    }
                }
            }
            logger.info(`僵屍處理程序清理完成，共清理 ${cleanedCount} 個處理程序`);
        }
        catch (error) {
            logger.warn('清理僵屍處理程序時出錯:', error);
        }
    }
    /**
     * 強制使用指定連接埠
     */
    async forcePort(port, killProcess = false) {
        logger.info(`強制使用連接埠: ${port}`);
        // 檢查連接埠是否可用
        const available = await this.isPortAvailable(port);
        if (available) {
            logger.info(`連接埠 ${port} 可用，直接使用`);
            return port;
        }
        if (!killProcess) {
            throw new MCPError(`Port ${port} is occupied and killProcess is disabled`, 'PORT_OCCUPIED', { port, killProcess });
        }
        // 嘗試強制釋放連接埠
        logger.warn(`連接埠 ${port} 被佔用，嘗試強制釋放...`);
        const released = await processManager.forceReleasePort(port);
        if (!released) {
            throw new MCPError(`Failed to force release port ${port}`, 'PORT_FORCE_RELEASE_FAILED', { port });
        }
        // 再次檢查連接埠是否可用
        const finalCheck = await this.isPortAvailable(port);
        if (!finalCheck) {
            throw new MCPError(`Port ${port} is still occupied after force release`, 'PORT_STILL_OCCUPIED', { port });
        }
        logger.info(`連接埠 ${port} 強制釋放成功`);
        return port;
    }
    /**
     * 等待連接埠釋放（增強版本）
     */
    async waitForPortRelease(port, timeoutMs = 10000) {
        const startTime = Date.now();
        logger.info(`等待連接埠 ${port} 釋放，逾時時間: ${timeoutMs}ms`);
        while (Date.now() - startTime < timeoutMs) {
            // 使用深度檢查確保連接埠真正可用
            if (await this.isPortTrulyAvailable(port)) {
                logger.info(`連接埠 ${port} 已完全釋放`);
                return;
            }
            // 等待200ms後重試（增加等待時間）
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        throw new MCPError(`Port ${port} was not released within ${timeoutMs}ms`, 'PORT_RELEASE_TIMEOUT', { port, timeoutMs });
    }
    /**
     * 清理指定連接埠（強制釋放並等待）
     */
    async cleanupPort(port) {
        logger.info(`開始清理連接埠: ${port}`);
        // 檢查連接埠是否被佔用
        const processInfo = await processManager.getPortProcess(port);
        if (!processInfo) {
            logger.info(`連接埠 ${port} 未被佔用，無需清理`);
            return;
        }
        logger.info(`發現佔用連接埠 ${port} 的處理程序:`, {
            pid: processInfo.pid,
            name: processInfo.name,
            command: processInfo.command
        });
        // 檢查是否是安全的處理程序
        if (!processManager.isSafeToKill(processInfo)) {
            logger.warn(`連接埠 ${port} 被不安全的處理程序佔用，跳過清理: ${processInfo.name}`);
            return;
        }
        // 嘗試終止處理程序
        logger.info(`嘗試終止佔用連接埠 ${port} 的處理程序: ${processInfo.pid}`);
        const killed = await processManager.killProcess(processInfo.pid, false);
        if (killed) {
            // 等待連接埠釋放
            try {
                await this.waitForPortRelease(port, 5000);
                logger.info(`連接埠 ${port} 清理成功`);
            }
            catch (error) {
                logger.warn(`連接埠 ${port} 清理後仍未釋放，可能需要更多時間`);
            }
        }
        else {
            logger.warn(`無法終止佔用連接埠 ${port} 的處理程序: ${processInfo.pid}`);
        }
    }
    /**
     * 強制釋放連接埠（終止佔用處理程序）
     */
    async forceReleasePort(port) {
        logger.warn(`強制釋放連接埠: ${port}`);
        try {
            const processInfo = await processManager.getPortProcess(port);
            if (processInfo) {
                logger.info(`發現佔用連接埠 ${port} 的處理程序: PID ${processInfo.pid}, 名稱: ${processInfo.name}`);
                const killed = await processManager.killProcess(processInfo.pid, true);
                if (!killed) {
                    throw new MCPError(`Failed to kill process ${processInfo.pid} occupying port ${port}`, 'PROCESS_KILL_FAILED', { pid: processInfo.pid, port });
                }
            }
            await this.waitForPortRelease(port, 3000);
            logger.info(`連接埠 ${port} 強制釋放成功`);
        }
        catch (error) {
            logger.error(`強制釋放連接埠 ${port} 失敗:`, error);
            throw new MCPError(`Failed to force release port ${port}`, 'FORCE_RELEASE_FAILED', error);
        }
    }
}
//# sourceMappingURL=port-manager.js.map