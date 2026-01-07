/**
 * user-feedback MCP Tools - MCP伺服器實作
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Config } from '../types/index.js';
/**
 * MCP伺服器類別
 */
export declare class MCPServer {
    private mcpServer;
    private webServer;
    private config;
    private isRunning;
    private sseTransport;
    constructor(config: Config);
    /**
     * 取得 McpServer 實例（供 HTTP 傳輸使用）
     */
    getMcpServerInstance(): McpServer;
    /**
     * 取得 SSE Transport 實例
     */
    getSSETransport(): SSEServerTransport | null;
    /**
     * 設定 SSE Transport（由 WebServer 建立後注入）
     */
    setSSETransport(transport: SSEServerTransport): void;
    /**
     * 連接 SSE Transport
     */
    connectSSETransport(transport: SSEServerTransport): Promise<void>;
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
     * 使用 HTTP 傳輸模式啟動（SSE 或 Streamable HTTP）
     * @param transportMode - 傳輸模式：'sse' 或 'streamable-http'
     */
    startWithHTTPTransport(transportMode: 'sse' | 'streamable-http'): Promise<void>;
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