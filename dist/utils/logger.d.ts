/**
 * user-feedback MCP Tools - 日志工具
 */
import { LogLevel, MCPLogLevel, MCPLogMessage } from '../types/index.js';
declare class Logger {
    private currentLevel;
    private logFile?;
    private fileLoggingEnabled;
    private colorsDisabled;
    private mcpLogLevel;
    private mcpLogCallback;
    private dbLoggingEnabled;
    private logBuffer;
    private flushInterval;
    private currentSource;
    private lastCleanupDate;
    private readonly BUFFER_SIZE;
    private readonly FLUSH_INTERVAL_MS;
    private readonly LOG_RETENTION_DAYS;
    private insertLogsFunc;
    private cleanupOldLogsFunc;
    constructor();
    /**
     * 設定日誌來源（用於標記日誌來自哪個模組）
     */
    setSource(source: string): void;
    /**
     * 啟用/禁用資料庫日誌
     */
    setDatabaseLogging(enabled: boolean): void;
    /**
     * 延遲載入 database 函數
     */
    private loadDatabaseFunctions;
    /**
     * 寫入日誌到資料庫緩衝區
     */
    private writeToDatabase;
    /**
     * 批次寫入資料庫
     */
    private flushToDatabase;
    /**
     * 檢查並清理過期日誌（每日執行一次）
     */
    private checkAndCleanupOldLogs;
    /**
     * 设置日志级别
     */
    setLevel(level: LogLevel): void;
    /**
     * 获取当前日志级别
     */
    getLevel(): LogLevel;
    /**
     * 禁用颜色输出（用于MCP模式）
     */
    disableColors(): void;
    /**
     * 设置MCP日志级别
     */
    setMCPLogLevel(level: MCPLogLevel): void;
    /**
     * 获取MCP日志级别
     */
    getMCPLogLevel(): MCPLogLevel;
    /**
     * 设置MCP日志回调函数
     */
    setMCPLogCallback(callback: (message: MCPLogMessage) => void): void;
    /**
     * 清除MCP日志回调函数
     */
    clearMCPLogCallback(): void;
    /**
     * 启用文件日志记录
     */
    enableFileLogging(logDir?: string): void;
    /**
     * 检查是否应该输出指定级别的日志
     */
    private shouldLog;
    /**
     * 检查是否应该发送MCP日志
     */
    private shouldSendMCPLog;
    /**
     * 发送MCP日志通知
     */
    private sendMCPLog;
    /**
     * 格式化时间戳
     */
    private formatTimestamp;
    /**
     * 格式化日志消息
     */
    private formatMessage;
    /**
     * 输出日志
     */
    private log;
    /**
     * 移除颜色代码
     */
    private removeColorCodes;
    /**
     * 错误日志
     */
    error(message: string, ...args: unknown[]): void;
    /**
     * 警告日志
     */
    warn(message: string, ...args: unknown[]): void;
    /**
     * 信息日志
     */
    info(message: string, ...args: unknown[]): void;
    /**
     * 调试日志
     */
    debug(message: string, ...args: unknown[]): void;
    /**
     * 记录HTTP请求
     */
    request(method: string, url: string, statusCode?: number, duration?: number): void;
    /**
     * 记录WebSocket事件
     */
    socket(event: string, sessionId?: string, data?: unknown): void;
    /**
     * 记录MCP工具调用
     */
    mcp(tool: string, params?: unknown, result?: unknown): void;
    /**
     * 发送MCP通知级别日志
     */
    mcpNotice(message: string, data?: unknown): void;
    /**
     * 发送MCP警告级别日志
     */
    mcpWarning(message: string, data?: unknown): void;
    /**
     * 发送MCP错误级别日志
     */
    mcpError(message: string, data?: unknown): void;
    /**
     * 发送MCP关键级别日志
     */
    mcpCritical(message: string, data?: unknown): void;
    /**
     * 发送服务器启动信息到MCP客户端
     */
    mcpServerStarted(port: number, url: string): void;
    /**
     * 发送反馈页面创建信息到MCP客户端
     */
    mcpFeedbackPageCreated(sessionId: string, feedbackUrl: string, timeoutSeconds: number): void;
    /**
     * 发送工具调用开始信息到MCP客户端
     */
    mcpToolCallStarted(toolName: string, params: unknown): void;
}
export declare const logger: Logger;
export type { LogLevel };
//# sourceMappingURL=logger.d.ts.map