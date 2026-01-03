/**
 * user-feedback MCP Tools - MCP伺服器實作
 */
import { Config } from '../types/index.js';
/**
 * MCP伺服器類別
 */
export declare class MCPServer {
    private mcpServer;
    private webServer;
    private config;
    private isRunning;
    constructor(config: Config);
    /**
     * 註冊MCP工具函式
     */
    private registerTools;
    /**
     * 設定MCP日誌功能
     */
    private setupLogging;
    /**
     * 傳送MCP日誌通知
     */
    private sendLogNotification;
    private deferredStartupTriggered;
    /**
     * 實作collect_feedback功能
     */
    private collectFeedback;
    /**
     * 將回饋資料格式化為MCP內容（支援圖片顯示）
     */
    private formatFeedbackForMCP;
    /**
     * 將回饋資料格式化為文字（保留用於其他用途）
     */
    private formatFeedbackAsText;
    /**
     * 啟動MCP伺服器
     */
    start(): Promise<void>;
    /**
     * 僅啟動Web模式
     */
    startWebOnly(): Promise<void>;
    /**
     * 停止伺服器
     */
    stop(): Promise<void>;
    /**
     * 取得伺服器狀態
     */
    getStatus(): {
        running: boolean;
        webPort?: number | undefined;
    };
}
//# sourceMappingURL=mcp-server.d.ts.map