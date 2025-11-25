/**
 * user-feedback MCP Tools - 日志工具
 */
import fs from 'fs';
import path from 'path';
// 日志级别优先级
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    silent: 999
};
// MCP日志级别优先级
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
// 内部日志级别到MCP日志级别的映射
const LOG_LEVEL_TO_MCP = {
    error: 'error',
    warn: 'warning',
    info: 'info',
    debug: 'debug',
    silent: 'info' // silent模式下如果需要发送MCP日志，使用info级别
};
/**
 * 检测是否为远程环境
 */
function isRemoteEnvironment() {
    // 检测常见的远程环境标识
    return !!(process.env['SSH_CLIENT'] ||
        process.env['SSH_TTY'] ||
        process.env['VSCODE_REMOTE'] ||
        process.env['CODESPACES'] ||
        process.env['GITPOD_WORKSPACE_ID'] ||
        process.env['REMOTE_CONTAINERS'] ||
        process.env['WSL_DISTRO_NAME']);
}
// 日志颜色
const LOG_COLORS = {
    error: '\x1b[31m', // 红色
    warn: '\x1b[33m', // 黄色
    info: '\x1b[36m', // 青色
    debug: '\x1b[37m', // 白色
    silent: '' // 无颜色
};
const RESET_COLOR = '\x1b[0m';
// 敏感資訊脫敏正則表達式
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
    // MCP日志相关
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
     * 啟用/禁用資料庫日誌
     */
    setDatabaseLogging(enabled) {
        this.dbLoggingEnabled = enabled;
    }
    /**
     * 延遲載入 database 函數
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
     * 设置日志级别
     */
    setLevel(level) {
        this.currentLevel = level;
    }
    /**
     * 获取当前日志级别
     */
    getLevel() {
        return this.currentLevel;
    }
    /**
     * 禁用颜色输出（用于MCP模式）
     */
    disableColors() {
        this.colorsDisabled = true;
    }
    /**
     * 设置MCP日志级别
     */
    setMCPLogLevel(level) {
        this.mcpLogLevel = level;
    }
    /**
     * 获取MCP日志级别
     */
    getMCPLogLevel() {
        return this.mcpLogLevel;
    }
    /**
     * 设置MCP日志回调函数
     */
    setMCPLogCallback(callback) {
        this.mcpLogCallback = callback;
    }
    /**
     * 清除MCP日志回调函数
     */
    clearMCPLogCallback() {
        this.mcpLogCallback = undefined;
    }
    /**
     * 启用文件日志记录
     */
    enableFileLogging(logDir = 'logs') {
        try {
            // 确保日志目录存在
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            // 生成日志文件名
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.logFile = path.join(logDir, `mcp-debug-${timestamp}.log`);
            this.fileLoggingEnabled = true;
            // 写入日志文件头
            const header = '=== user-feedback MCP Tools Debug Log ===\n' +
                `Start Time: ${new Date().toISOString()}\n` +
                `Log Level: ${this.currentLevel}\n` +
                '==========================================\n\n';
            fs.writeFileSync(this.logFile, header);
            process.stderr.write(`日志文件已创建: ${this.logFile}\n`);
        }
        catch (error) {
            process.stderr.write(`无法创建日志文件: ${error}\n`);
            this.fileLoggingEnabled = false;
        }
    }
    /**
     * 检查是否应该输出指定级别的日志
     */
    shouldLog(level) {
        // silent模式下不输出任何日志
        if (this.currentLevel === 'silent') {
            return false;
        }
        return LOG_LEVELS[level] <= LOG_LEVELS[this.currentLevel];
    }
    /**
     * 检查是否应该发送MCP日志
     */
    shouldSendMCPLog(level) {
        return MCP_LOG_LEVELS[level] <= MCP_LOG_LEVELS[this.mcpLogLevel];
    }
    /**
     * 发送MCP日志通知
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
            // 避免日志回调错误导致程序崩溃
            process.stderr.write(`MCP log callback error: ${error}\n`);
        }
    }
    /**
     * 格式化时间戳
     */
    formatTimestamp() {
        return new Date().toISOString();
    }
    /**
     * 格式化日志消息
     */
    formatMessage(level, message, ...args) {
        const timestamp = this.formatTimestamp();
        const levelStr = level.toUpperCase().padEnd(5);
        let formattedMessage;
        if (this.colorsDisabled) {
            // 无颜色模式（用于MCP）
            formattedMessage = `[${timestamp}] ${levelStr} ${message}`;
        }
        else {
            // 有颜色模式（用于终端）
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
     * 输出日志
     */
    log(level, message, ...args) {
        if (!this.shouldLog(level))
            return;
        const formattedMessage = this.formatMessage(level, message, ...args);
        // 控制台输出 - 总是使用 stderr 避免污染 stdout（MCP JSON-RPC 协议需要纯净的 stdout）
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
        // 文件输出（去除颜色代码）
        if (this.fileLoggingEnabled && this.logFile) {
            try {
                const cleanMessage = this.removeColorCodes(formattedMessage);
                fs.appendFileSync(this.logFile, cleanMessage + '\n');
            }
            catch (error) {
                process.stderr.write(`写入日志文件失败: ${error}\n`);
            }
        }
        // 寫入資料庫
        const context = args.length > 0 ? args : undefined;
        this.writeToDatabase(level, message, context);
        // 发送MCP日志通知
        const mcpLevel = LOG_LEVEL_TO_MCP[level];
        const logData = args.length > 0 ? { message, args } : message;
        this.sendMCPLog(mcpLevel, message, logData);
    }
    /**
     * 移除颜色代码
     */
    removeColorCodes(text) {
        // eslint-disable-next-line no-control-regex -- strip ANSI color codes
        return text.replace(/\x1B\[[0-9;]*m/g, '');
    }
    /**
     * 错误日志
     */
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    /**
     * 警告日志
     */
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    /**
     * 信息日志
     */
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    /**
     * 调试日志
     */
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
    /**
     * 记录HTTP请求
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
     * 记录WebSocket事件
     */
    socket(event, sessionId, data) {
        const parts = ['WebSocket', event];
        if (sessionId)
            parts.push(`session:${sessionId}`);
        this.debug(parts.join(' '), data);
    }
    /**
     * 记录MCP工具调用
     */
    mcp(tool, params, result) {
        this.info(`MCP Tool: ${tool}`, { params, result });
    }
    /**
     * 发送MCP通知级别日志
     */
    mcpNotice(message, data) {
        this.sendMCPLog('notice', message, data);
    }
    /**
     * 发送MCP警告级别日志
     */
    mcpWarning(message, data) {
        this.sendMCPLog('warning', message, data);
    }
    /**
     * 发送MCP错误级别日志
     */
    mcpError(message, data) {
        this.sendMCPLog('error', message, data);
    }
    /**
     * 发送MCP关键级别日志
     */
    mcpCritical(message, data) {
        this.sendMCPLog('critical', message, data);
    }
    /**
     * 发送服务器启动信息到MCP客户端
     */
    mcpServerStarted(port, url) {
        const isRemote = isRemoteEnvironment();
        this.mcpNotice('Web服务器已启动', {
            port: port,
            url: url,
            status: 'ready',
            remote_environment: isRemote
        });
        if (isRemote) {
            this.mcpNotice('检测到远程环境，建议配置端口转发', {
                local_port: port,
                forward_url: url,
                vscode_tip: 'VSCode会自动提示端口转发，或手动在端口面板中添加'
            });
        }
    }
    /**
     * 发送反馈页面创建信息到MCP客户端
     */
    mcpFeedbackPageCreated(sessionId, feedbackUrl, timeoutSeconds) {
        const isRemote = isRemoteEnvironment();
        this.mcpNotice('反馈页面已创建', {
            session_id: sessionId,
            feedback_url: feedbackUrl,
            expires_in: `${timeoutSeconds}秒`,
            remote_environment: isRemote
        });
        if (isRemote) {
            this.mcpNotice('远程访问提示', {
                original_url: feedbackUrl,
                access_tip: '请确保已配置端口转发，然后访问转发后的地址',
                vscode_ports_panel: '查看VSCode底部的"端口"面板'
            });
        }
    }
    /**
     * 发送工具调用开始信息到MCP客户端
     */
    mcpToolCallStarted(toolName, params) {
        this.mcpNotice(`MCP工具调用: ${toolName}`, {
            tool: toolName,
            parameters: params,
            timestamp: new Date().toISOString()
        });
    }
}
// 创建全局日志实例
export const logger = new Logger();
//# sourceMappingURL=logger.js.map