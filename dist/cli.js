#!/usr/bin/env node
/**
 * user-feedback MCP Tools - CLI入口
 */
import { program } from 'commander';
import { getConfig, displayConfig } from './config/index.js';
import { logger } from './utils/logger.js';
import { MCPServer } from './server/mcp-server.js';
import { MCPError } from './types/index.js';
import { getPackageVersion } from './utils/version.js';
import { InstanceLock } from './utils/instance-lock.js';
const VERSION = getPackageVersion();
// 在最开始检测MCP模式并设置日志级别
// 改进的MCP模式检测：检查多个条件
const isMCPMode = !process.stdin.isTTY ||
    process.env['NODE_ENV'] === 'mcp' ||
    process.argv.includes('--mcp-mode');
if (isMCPMode) {
    logger.disableColors();
    logger.setLevel('silent');
}
function getRuntimeFetch() {
    if (typeof fetch === 'function') {
        return fetch;
    }
    throw new MCPError('Fetch API is not available in this environment', 'FETCH_UNSUPPORTED');
}
/**
 * 顯示歡迎資訊
 */
function showWelcome() {
    console.log('user-feedback MCP Tools v' + VERSION);
    console.log('基於Node.js的現代化回饋收集器\n');
}
/**
 * 啟動MCP伺服器
 */
async function startMCPServer(options) {
    try {
        // 載入設定
        const config = getConfig();
        if (!isMCPMode) {
            // 交互模式：顯示歡迎資訊和設定日誌級別
            showWelcome();
            logger.setLevel(config.logLevel);
        }
        // 應用命令列參數
        if (options.port) {
            config.webPort = options.port;
        }
        // 設定除錯模式（僅在非MCP模式下）
        if (!isMCPMode && (options.debug || process.env['LOG_LEVEL'] === 'debug')) {
            config.logLevel = 'debug';
            // 啟用檔案日誌記錄
            logger.enableFileLogging();
            logger.setLevel('debug');
            logger.debug('🐛 除錯模式已啟用，日誌將儲存到檔案');
        }
        // 顯示設定資訊
        if (logger.getLevel() === 'debug') {
            displayConfig(config);
            console.log('');
        }
        // 設定鎖定檔案路徑（如果有配置）
        if (config.lockFilePath) {
            InstanceLock.setLockFilePath(config.lockFilePath);
        }
        // 檢查是否需要強制啟動新實例
        const forceNewInstance = options.forceNew || config.forceNewInstance;
        // 單一實例檢測（除非強制啟動新實例）
        if (!forceNewInstance) {
            const instanceCheck = await InstanceLock.check(config.healthCheckTimeout);
            if (instanceCheck.running && instanceCheck.port) {
                logger.info(`檢測到已運行的實例: PID=${instanceCheck.pid}, Port=${instanceCheck.port}`);
                if (isMCPMode) {
                    // MCP 模式下，輸出現有實例資訊後繼續運行
                    // 讓 MCP 客戶端連接到現有實例
                    logger.debug(`MCP模式: 連接到現有實例 http://localhost:${instanceCheck.port}`);
                }
                else {
                    // 交互模式下，顯示提示並退出
                    console.log(`\n✓ 已有 User Feedback 實例運行中`);
                    console.log(`  端口: ${instanceCheck.port}`);
                    console.log(`  PID: ${instanceCheck.pid}`);
                    console.log(`  訪問: http://localhost:${instanceCheck.port}`);
                    console.log(`\n使用 --force-new 強制啟動新實例`);
                }
                return;
            }
        }
        else {
            logger.info('強制啟動新實例模式');
            await InstanceLock.forceCleanup();
        }
        // 建立並啟動MCP伺服器
        const server = new MCPServer(config);
        // 決定啟動模式：
        // 1. 明確指定 --web 時使用 Web 模式
        // 2. TTY 模式（直接在終端運行）時自動使用 Web 模式
        // 3. 其他情況（被 MCP 客戶端調用）使用完整 MCP 模式
        const useWebOnly = options.web || (!isMCPMode && process.stdin.isTTY);
        if (useWebOnly) {
            // 僅Web模式
            logger.info('啟動Web模式...');
            await server.startWebOnly();
        }
        else {
            // 完整MCP模式
            logger.info('啟動MCP伺服器...');
            await server.start();
        }
        // 獲取鎖定（伺服器啟動成功後）
        const status = server.getStatus();
        if (status.webPort) {
            const lockAcquired = await InstanceLock.acquire(status.webPort);
            if (!lockAcquired) {
                logger.warn('無法獲取實例鎖定，可能存在競爭條件');
            }
        }
        // 注意：優雅關閉處理已在WebServer中實作，這裡不需要重複處理
    }
    catch (error) {
        if (error instanceof MCPError) {
            logger.error(`MCP錯誤 [${error.code}]: ${error.message}`);
            if (error.details) {
                logger.debug('錯誤詳情:', error.details);
            }
        }
        else if (error instanceof Error) {
            logger.error('啟動失敗:', error.message);
            logger.debug('錯誤堆疊:', error.stack);
        }
        else {
            logger.error('未知錯誤:', error);
        }
        process.exit(1);
    }
}
/**
 * 顯示健康檢查資訊
 */
async function healthCheck() {
    try {
        const config = getConfig();
        console.log('設定驗證通過');
        console.log(`API端點: ${config.apiBaseUrl}`);
        console.log(`API金鑰: ${config.apiKey ? '已設定' : '未設定'}`);
        console.log(`Web連接埠: ${config.webPort}`);
        console.log(`逾時時間: ${config.dialogTimeout}秒`);
        // TODO: 新增更多健康檢查項
        // - 連接埠可用性檢查
        // - API連線測試
        // - 依賴項檢查
    }
    catch (error) {
        if (error instanceof MCPError) {
            console.error(`設定錯誤 [${error.code}]: ${error.message}`);
        }
        else {
            console.error('健康檢查失敗:', error);
        }
        process.exit(1);
    }
}
// 配置CLI命令
program
    .name('user-web-feedback')
    .description('基於Node.js的MCP回饋收集器')
    .version(VERSION);
// 主命令 - 啟動伺服器
program
    .command('start', { isDefault: true })
    .description('啟動MCP回饋收集器')
    .option('-p, --port <number>', '指定Web伺服器連接埠', parseInt)
    .option('-w, --web', '僅啟動Web模式（不啟動MCP伺服器）')
    .option('-c, --config <path>', '指定設定檔路徑')
    .option('-d, --debug', '啟用除錯模式（顯示詳細的MCP通訊日誌）')
    .option('--mcp-mode', '強制啟用MCP模式（用於除錯）')
    .option('-f, --force-new', '強制啟動新實例（忽略已運行的實例）')
    .action(startMCPServer);
// 健康檢查命令
program
    .command('health')
    .description('檢查設定和系統狀態')
    .action(healthCheck);
// 設定顯示命令
program
    .command('config')
    .description('顯示當前設定')
    .action(() => {
    try {
        const config = getConfig();
        displayConfig(config);
    }
    catch (error) {
        console.error('設定載入失敗:', error);
        process.exit(1);
    }
});
// 效能監控命令
program
    .command('metrics')
    .description('顯示效能監控指標')
    .option('-f, --format <format>', '輸出格式 (json|text)', 'text')
    .action(async (options) => {
    try {
        showWelcome();
        const config = getConfig();
        logger.setLevel('error'); // 減少日誌輸出
        logger.info('🔍 取得效能監控指標...');
        // 建立MCP伺服器實例
        const server = new MCPServer(config);
        // 啟動Web伺服器
        await server.startWebOnly();
        // 等待伺服器完全啟動
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
            const runtimeFetch = getRuntimeFetch();
            const response = await runtimeFetch(`http://localhost:${server.getStatus().webPort}/api/metrics`);
            const metrics = await response.json();
            if (options.format === 'json') {
                console.log(JSON.stringify(metrics, null, 2));
            }
            else {
                const reportResponse = await runtimeFetch(`http://localhost:${server.getStatus().webPort}/api/performance-report`);
                const report = await reportResponse.text();
                console.log(report);
            }
        }
        catch (error) {
            logger.error('取得效能指標失敗:', error);
        }
        await server.stop();
    }
    catch (error) {
        logger.error('效能監控失敗:', error);
        process.exit(1);
    }
});
// 測試MCP工具函式命令
program
    .command('test-feedback')
    .description('測試collect_feedback工具函式')
    .option('-m, --message <message>', '測試工作匯報內容', '這是一個測試工作匯報，用於驗證collect_feedback功能是否正常運作。')
    .option('-t, --timeout <seconds>', '會話逾時時間（秒）', '30')
    .action(async (options) => {
    try {
        showWelcome();
        const config = getConfig();
        logger.setLevel(config.logLevel);
        logger.info('開始測試collect_feedback工具函式...');
        // 建立MCP伺服器實例
        const server = new MCPServer(config);
        // 啟動Web伺服器
        await server.startWebOnly();
        // 等待伺服器完全啟動
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 建立測試會話
        logger.info('建立測試會話...');
        const timeoutSeconds = parseInt(options.timeout) || 30;
        const testParams = {
            work_summary: options.message,
            timeout_seconds: timeoutSeconds
        };
        try {
            const runtimeFetch = getRuntimeFetch();
            const response = await runtimeFetch(`http://localhost:${server.getStatus().webPort}/api/test-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testParams)
            });
            const result = await response.json();
            if (result.success) {
                logger.info('測試會話建立成功');
                logger.info(`會話ID: ${result.session_id}`);
                logger.info(`回饋頁面: ${result.feedback_url}`);
                // 自動開啟瀏覽器
                try {
                    const open = await import('open');
                    await open.default(result.feedback_url);
                    logger.info('瀏覽器已自動開啟回饋頁面');
                }
                catch (error) {
                    logger.warn('無法自動開啟瀏覽器，請手動存取上述URL');
                }
                logger.info('現在您可以在瀏覽器中測試完整的回饋流程');
                logger.info(`會話將在 ${timeoutSeconds} 秒後逾時`);
            }
            else {
                logger.error('測試會話建立失敗:', result.error);
            }
        }
        catch (error) {
            logger.error('建立測試會話時出錯:', error);
        }
        // 保持處理程序執行
        process.stdin.resume();
    }
    catch (error) {
        logger.error('測試失敗:', error);
        if (error instanceof Error) {
            logger.error('錯誤詳情:', error.message);
            logger.error('錯誤堆疊:', error.stack);
        }
        process.exit(1);
    }
});
// 解析命令列參數
program.parse();
//# sourceMappingURL=cli.js.map