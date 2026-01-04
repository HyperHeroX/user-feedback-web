/**
 * user-feedback MCP Tools - 日誌工具
 */
import fs from 'fs';
import path from 'path';
// 日誌級別優先級
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    silent: 999
};
// MCP日誌級別優先級
const MCP_LOG_LEVELS = {
    emergency: 0,
    alert: 1,
    critical: 2,
    error: 3,
    warning: 4,
    notice: 5,
    info: 6,
    debug: 7
};
// 內部日誌級別到MCP日誌級別的對映
const LOG_LEVEL_TO_MCP = {
    error: 'error',
    warn: 'warning',
    info: 'info',
    debug: 'debug',
    silent: 'info' // silent模式下如果需要傳送MCP日誌，使用info級別
};
/**
 * 檢測是否為遠端環境
 */
function isRemoteEnvironment() {
    // 檢測常見的遠端環境標識
    return !!(process.env['SSH_CLIENT'] ||
        process.env['SSH_TTY'] ||
        process.env['VSCODE_REMOTE'] ||
        process.env['CODESPACES'] ||
        process.env['GITPOD_WORKSPACE_ID'] ||
        process.env['REMOTE_CONTAINERS'] ||
        process.env['WSL_DISTRO_NAME']);
}
// 日誌顏色
const LOG_COLORS = {
    error: '\x1b[31m', // 紅色
    warn: '\x1b[33m', // 黃色
    info: '\x1b[36m', // 青色
    debug: '\x1b[37m', // 白色
    silent: '' // 無顏色
};
const RESET_COLOR = '\x1b[0m';
// 敏感資訊脫敏正則運算式
const SENSITIVE_PATTERNS = [
    // API Keys (各種格式)
    { pattern: /sk-[a-zA-Z0-9]{20,}/g, replacement: 'sk-***' },
    { pattern: /AIza[a-zA-Z0-9_-]{35}/g, replacement: 'AIza***' },
    { pattern: /api[_-]?key['":\s]*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi, replacement: 'api_key: ***' },
    // Bearer tokens
    { pattern: /Bearer\s+[a-zA-Z0-9_.-]+/gi, replacement: 'Bearer ***' },
    // 長字串 token (保留首尾各4字元)
    { pattern: /([a-zA-Z0-9]{4})[a-zA-Z0-9]{16,}([a-zA-Z0-9]{4})/g, replacement: '$1***$2' },
];
/**
 * 敏感資訊脫敏
 */
function sanitizeLogMessage(message) {
    let sanitized = message;
    for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
        sanitized = sanitized.replace(pattern, replacement);
    }
    return sanitized;
}
class Logger {
    currentLevel = 'info';
    logFile;
    fileLoggingEnabled = false;
    colorsDisabled = false;
    // MCP日誌相關
    mcpLogLevel = 'info';
    mcpLogCallback = undefined;
    // 資料庫日誌相關
    dbLoggingEnabled = true;
    logBuffer = [];
    flushInterval = null;
    currentSource = 'system';
    lastCleanupDate = '';
    BUFFER_SIZE = 10;
    FLUSH_INTERVAL_MS = 5000;
    LOG_RETENTION_DAYS = 30;
    // 延遲載入 database 模組以避免循環依賴
    insertLogsFunc = null;
    cleanupOldLogsFunc = null;
    constructor() {
        // 設定定時刷新
        this.flushInterval = setInterval(() => {
            this.flushToDatabase();
        }, this.FLUSH_INTERVAL_MS);
        // 確保程式退出時刷新緩衝區
        process.on('beforeExit', () => {
            this.flushToDatabase();
        });
    }
    /**
     * 設定日誌來源（用於標記日誌來自哪個模組）
     */
    setSource(source) {
        this.currentSource = source;
    }
    /**
     * 啟用/停用資料庫日誌
     */
    setDatabaseLogging(enabled) {
        this.dbLoggingEnabled = enabled;
    }
    /**
     * 停止 Logger 的所有計時器（用於測試清理）
     */
    destroy() {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        // 同步刷新剩餘的日誌
        this.flushToDatabase();
    }
    /**
     * 延遲載入 database 函式
     */
    async loadDatabaseFunctions() {
        if (this.insertLogsFunc)
            return;
        try {
            const { insertLogs, cleanupOldLogs } = await import('./database.js');
            this.insertLogsFunc = insertLogs;
            this.cleanupOldLogsFunc = cleanupOldLogs;
        }
        catch (error) {
            // 載入失敗時靜默處理
            this.dbLoggingEnabled = false;
        }
    }
    /**
     * 寫入日誌到資料庫緩衝區
     */
    writeToDatabase(level, message, context) {
        if (!this.dbLoggingEnabled || level === 'silent')
            return;
        // 檢查是否需要執行每日清理
        this.checkAndCleanupOldLogs();
        // 脫敏處理
        const sanitizedMessage = sanitizeLogMessage(message);
        const sanitizedContext = context
            ? sanitizeLogMessage(typeof context === 'string' ? context : JSON.stringify(context))
            : undefined;
        this.logBuffer.push({
            level,
            message: sanitizedMessage,
            context: sanitizedContext,
            source: this.currentSource,
            createdAt: new Date().toISOString()
        });
        // 達到閾值時刷新
        if (this.logBuffer.length >= this.BUFFER_SIZE) {
            this.flushToDatabase();
        }
    }
    /**
     * 批次寫入資料庫
     */
    async flushToDatabase() {
        if (this.logBuffer.length === 0)
            return;
        const logsToWrite = [...this.logBuffer];
        this.logBuffer = [];
        try {
            await this.loadDatabaseFunctions();
            if (this.insertLogsFunc) {
                this.insertLogsFunc(logsToWrite);
            }
        }
        catch (error) {
            // 寫入失敗時輸出到 stderr，避免遞迴
            process.stderr.write(`Failed to write logs to database: ${error}\n`);
        }
    }
    /**
     * 檢查並清理過期日誌（每日執行一次）
     */
    async checkAndCleanupOldLogs() {
        const todayParts = new Date().toISOString().split('T');
        const today = todayParts[0] ?? '';
        if (this.lastCleanupDate === today)
            return;
        this.lastCleanupDate = today;
        try {
            await this.loadDatabaseFunctions();
            if (this.cleanupOldLogsFunc) {
                const deleted = this.cleanupOldLogsFunc(this.LOG_RETENTION_DAYS);
                if (deleted > 0) {
                    process.stderr.write(`[Logger] Cleaned up ${deleted} old log entries\n`);
                }
            }
        }
        catch (error) {
            // 清理失敗時靜默處理
        }
    }
    /**
     * 設定日誌級別
     */
    setLevel(level) {
        this.currentLevel = level;
    }
    /**
     * 取得目前日誌級別
     */
    getLevel() {
        return this.currentLevel;
    }
    /**
     * 停用顏色輸出（用於MCP模式）
     */
    disableColors() {
        this.colorsDisabled = true;
    }
    /**
     * 設定MCP日誌級別
     */
    setMCPLogLevel(level) {
        this.mcpLogLevel = level;
    }
    /**
     * 取得MCP日誌級別
     */
    getMCPLogLevel() {
        return this.mcpLogLevel;
    }
    /**
     * 設定MCP日誌回呼函式
     */
    setMCPLogCallback(callback) {
        this.mcpLogCallback = callback;
    }
    /**
     * 清除MCP日誌回呼函式
     */
    clearMCPLogCallback() {
        this.mcpLogCallback = undefined;
    }
    /**
     * 啟用檔案日誌記錄
     */
    enableFileLogging(logDir = 'logs') {
        try {
            // 確保日誌目錄存在
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            // 產生日誌檔案名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.logFile = path.join(logDir, `mcp-debug-${timestamp}.log`);
            this.fileLoggingEnabled = true;
            // 寫入日誌檔案標頭
            const header = '=== user-feedback MCP Tools Debug Log ===\n' +
                `Start Time: ${new Date().toISOString()}\n` +
                `Log Level: ${this.currentLevel}\n` +
                '==========================================\n\n';
            fs.writeFileSync(this.logFile, header);
            process.stderr.write(`日誌檔案已建立: ${this.logFile}\n`);
        }
        catch (error) {
            process.stderr.write(`無法建立日誌檔案: ${error}\n`);
            this.fileLoggingEnabled = false;
        }
    }
    /**
     * 檢查是否應該輸出指定級別的日誌
     */
    shouldLog(level) {
        // silent模式下不輸出任何日誌
        if (this.currentLevel === 'silent') {
            return false;
        }
        return LOG_LEVELS[level] <= LOG_LEVELS[this.currentLevel];
    }
    /**
     * 檢查是否應該傳送MCP日誌
     */
    shouldSendMCPLog(level) {
        return MCP_LOG_LEVELS[level] <= MCP_LOG_LEVELS[this.mcpLogLevel];
    }
    /**
     * 傳送MCP日誌通知
     */
    sendMCPLog(level, message, data) {
        if (!this.mcpLogCallback || !this.shouldSendMCPLog(level)) {
            return;
        }
        const mcpMessage = {
            level,
            logger: 'user-web-feedback',
            data: data !== undefined ? data : message
        };
        try {
            this.mcpLogCallback(mcpMessage);
        }
        catch (error) {
            // 避免日誌回呼錯誤導致程式崩潰
            process.stderr.write(`MCP log callback error: ${error}\n`);
        }
    }
    /**
     * 格式化時間戳
     */
    formatTimestamp() {
        return new Date().toISOString();
    }
    /**
     * 格式化日誌訊息
     */
    formatMessage(level, message, ...args) {
        const timestamp = this.formatTimestamp();
        const levelStr = level.toUpperCase().padEnd(5);
        let formattedMessage;
        if (this.colorsDisabled) {
            // 無顏色模式（用於MCP）
            formattedMessage = `[${timestamp}] ${levelStr} ${message}`;
        }
        else {
            // 有顏色模式（用於終端）
            const color = LOG_COLORS[level];
            formattedMessage = `${color}[${timestamp}] ${levelStr}${RESET_COLOR} ${message}`;
        }
        if (args.length > 0) {
            const argsStr = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
            formattedMessage += ` ${argsStr}`;
        }
        return formattedMessage;
    }
    /**
     * 輸出日誌
     */
    log(level, message, ...args) {
        if (!this.shouldLog(level))
            return;
        const formattedMessage = this.formatMessage(level, message, ...args);
        // 控制台輸出 - 總是使用 stderr 避免污染 stdout（MCP JSON-RPC 協定需要純淨的 stdout）
        if (this.colorsDisabled) {
            // MCP 模式：使用 stderr 避免污染 stdout
            process.stderr.write(formattedMessage + '\n');
        }
        else {
            // 普通模式：使用 console 方法
            if (level === 'error') {
                console.error(formattedMessage);
            }
            else if (level === 'warn') {
                console.warn(formattedMessage);
            }
            else {
                console.log(formattedMessage);
            }
        }
        // 檔案輸出（去除顏色代碼）
        if (this.fileLoggingEnabled && this.logFile) {
            try {
                const cleanMessage = this.removeColorCodes(formattedMessage);
                fs.appendFileSync(this.logFile, cleanMessage + '\n');
            }
            catch (error) {
                process.stderr.write(`寫入日誌檔案失敗: ${error}\n`);
            }
        }
        // 寫入資料庫
        const context = args.length > 0 ? args : undefined;
        this.writeToDatabase(level, message, context);
        // 傳送MCP日誌通知
        const mcpLevel = LOG_LEVEL_TO_MCP[level];
        const logData = args.length > 0 ? { message, args } : message;
        this.sendMCPLog(mcpLevel, message, logData);
    }
    /**
     * 移除顏色代碼
     */
    removeColorCodes(text) {
        // eslint-disable-next-line no-control-regex -- strip ANSI color codes
        return text.replace(/\x1B\[[0-9;]*m/g, '');
    }
    /**
     * 錯誤日誌
     */
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    /**
     * 警告日誌
     */
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    /**
     * 資訊日誌
     */
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    /**
     * 除錯日誌
     */
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
    /**
     * 記錄HTTP請求
     */
    request(method, url, statusCode, duration) {
        const parts = [method.toUpperCase(), url];
        if (statusCode !== undefined)
            parts.push(`${statusCode}`);
        if (duration !== undefined)
            parts.push(`${duration}ms`);
        this.info(`HTTP ${parts.join(' ')}`);
    }
    /**
     * 記錄WebSocket事件
     */
    socket(event, sessionId, data) {
        const parts = ['WebSocket', event];
        if (sessionId)
            parts.push(`session:${sessionId}`);
        this.debug(parts.join(' '), data);
    }
    /**
     * 記錄MCP工具呼叫
     */
    mcp(tool, params, result) {
        this.info(`MCP Tool: ${tool}`, { params, result });
    }
    /**
     * 傳送MCP通知級別日誌
     */
    mcpNotice(message, data) {
        this.sendMCPLog('notice', message, data);
    }
    /**
     * 傳送MCP警告級別日誌
     */
    mcpWarning(message, data) {
        this.sendMCPLog('warning', message, data);
    }
    /**
     * 傳送MCP錯誤級別日誌
     */
    mcpError(message, data) {
        this.sendMCPLog('error', message, data);
    }
    /**
     * 傳送MCP關鍵級別日誌
     */
    mcpCritical(message, data) {
        this.sendMCPLog('critical', message, data);
    }
    /**
     * 傳送伺服器啟動資訊到MCP客戶端
     */
    mcpServerStarted(port, url) {
        const isRemote = isRemoteEnvironment();
        this.mcpNotice('Web伺服器已啟動', {
            port: port,
            url: url,
            status: 'ready',
            remote_environment: isRemote
        });
        if (isRemote) {
            this.mcpNotice('偵測到遠端環境，建議設定連接埠轉發', {
                local_port: port,
                forward_url: url,
                vscode_tip: 'VSCode會自動提示連接埠轉發，或手動在連接埠面板中新增'
            });
        }
    }
    /**
     * 傳送回饋頁面建立資訊到MCP客戶端
     */
    mcpFeedbackPageCreated(sessionId, feedbackUrl, timeoutSeconds) {
        const isRemote = isRemoteEnvironment();
        this.mcpNotice('回饋頁面已建立', {
            session_id: sessionId,
            feedback_url: feedbackUrl,
            expires_in: `${timeoutSeconds}秒`,
            remote_environment: isRemote
        });
        if (isRemote) {
            this.mcpNotice('遠端存取提示', {
                original_url: feedbackUrl,
                access_tip: '請確保已設定連接埠轉發，然後存取轉發後的位址',
                vscode_ports_panel: '查看VSCode底部的"連接埠"面板'
            });
        }
    }
    /**
     * 傳送工具呼叫開始資訊到MCP客戶端
     */
    mcpToolCallStarted(toolName, params) {
        this.mcpNotice(`MCP工具呼叫: ${toolName}`, {
            tool: toolName,
            parameters: params,
            timestamp: new Date().toISOString()
        });
    }
}
// 建立全域日誌實例
export const logger = new Logger();
//# sourceMappingURL=logger.js.map