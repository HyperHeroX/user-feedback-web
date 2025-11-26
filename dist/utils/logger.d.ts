/**
 * user-feedback MCP Tools - 日誌工具
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
     * 啟用/停用資料庫日誌
     */
    setDatabaseLogging(enabled: boolean): void;
    /**
     * 延遲載入 database 函式
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
     * 設定日誌級別
     */
    setLevel(level: LogLevel): void;
    /**
     * 取得目前日誌級別
     */
    getLevel(): LogLevel;
    /**
     * 停用顏色輸出（用於MCP模式）
     */
    disableColors(): void;
    /**
     * 設定MCP日誌級別
     */
    setMCPLogLevel(level: MCPLogLevel): void;
    /**
     * 取得MCP日誌級別
     */
    getMCPLogLevel(): MCPLogLevel;
    /**
     * 設定MCP日誌回呼函式
     */
    setMCPLogCallback(callback: (message: MCPLogMessage) => void): void;
    /**
     * 清除MCP日誌回呼函式
     */
    clearMCPLogCallback(): void;
    /**
     * 啟用檔案日誌記錄
     */
    enableFileLogging(logDir?: string): void;
    /**
     * 檢查是否應該輸出指定級別的日誌
     */
    private shouldLog;
    /**
     * 檢查是否應該傳送MCP日誌
     */
    private shouldSendMCPLog;
    /**
     * 傳送MCP日誌通知
     */
    private sendMCPLog;
    /**
     * 格式化時間戳
     */
    private formatTimestamp;
    /**
     * 格式化日誌訊息
     */
    private formatMessage;
    /**
     * 輸出日誌
     */
    private log;
    /**
     * 移除顏色代碼
     */
    private removeColorCodes;
    /**
     * 錯誤日誌
     */
    error(message: string, ...args: unknown[]): void;
    /**
     * 警告日誌
     */
    warn(message: string, ...args: unknown[]): void;
    /**
     * 資訊日誌
     */
    info(message: string, ...args: unknown[]): void;
    /**
     * 除錯日誌
     */
    debug(message: string, ...args: unknown[]): void;
    /**
     * 記錄HTTP請求
     */
    request(method: string, url: string, statusCode?: number, duration?: number): void;
    /**
     * 記錄WebSocket事件
     */
    socket(event: string, sessionId?: string, data?: unknown): void;
    /**
     * 記錄MCP工具呼叫
     */
    mcp(tool: string, params?: unknown, result?: unknown): void;
    /**
     * 傳送MCP通知級別日誌
     */
    mcpNotice(message: string, data?: unknown): void;
    /**
     * 傳送MCP警告級別日誌
     */
    mcpWarning(message: string, data?: unknown): void;
    /**
     * 傳送MCP錯誤級別日誌
     */
    mcpError(message: string, data?: unknown): void;
    /**
     * 傳送MCP關鍵級別日誌
     */
    mcpCritical(message: string, data?: unknown): void;
    /**
     * 傳送伺服器啟動資訊到MCP客戶端
     */
    mcpServerStarted(port: number, url: string): void;
    /**
     * 傳送回饋頁面建立資訊到MCP客戶端
     */
    mcpFeedbackPageCreated(sessionId: string, feedbackUrl: string, timeoutSeconds: number): void;
    /**
     * 傳送工具呼叫開始資訊到MCP客戶端
     */
    mcpToolCallStarted(toolName: string, params: unknown): void;
}
export declare const logger: Logger;
export type { LogLevel };
//# sourceMappingURL=logger.d.ts.map