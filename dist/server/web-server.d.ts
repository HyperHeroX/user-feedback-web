/**
 * user-feedback MCP Tools - Web伺服器實作
 */
import { Config, FeedbackData } from '../types/index.js';
/**
 * Web伺服器類別
 */
export declare class WebServer {
    private app;
    private server;
    private io;
    private config;
    private port;
    private isServerRunning;
    private portManager;
    private imageProcessor;
    private imageToTextService;
    private sessionStorage;
    private autoReplyTimers;
    private autoReplyWarningTimers;
    constructor(config: Config);
    /**
     * 解析靜態資源目錄，優先使用建置產物，其次回退到原始碼目錄
     * 使用模組的實際位置而不是 process.cwd()，以支援從任何目錄啟動的 MCP 模式
     */
    private getStaticAssetsPath;
    /**
     * 等待所有活躍會話完成或達到最大等待時間。
     * 這是簡單的輪詢實作，檢查 sessionStorage.getSessionCount() 是否降為 0。
     */
    private waitForActiveSessions;
    /**
     * 設定優雅結束處理
     */
    private setupGracefulShutdown;
    /**
     * 設定中介軟體
     */
    private setupMiddleware;
    /**
     * 設定路由
     */
    private setupRoutes;
    /**
     * 設定Socket.IO事件處理
     */
    private setupSocketHandlers;
    /**
     * 處理回饋提交
     */
    private handleFeedbackSubmission;
    /**
     * 啟動自動回覆計時器
     */
    private startAutoReplyTimer;
    /**
     * 重置自動回覆計時器
     */
    private resetAutoReplyTimer;
    /**
     * 清除自動回覆計時器
     */
    private clearAutoReplyTimers;
    /**
     * 收集使用者回饋
     */
    collectFeedback(workSummary: string, timeoutSeconds: number, projectName?: string, projectPath?: string): Promise<{
        feedback: FeedbackData[];
        sessionId: string;
        feedbackUrl: string;
        projectId: string;
        projectName: string;
    }>;
    private emitDashboardSessionCreated;
    private emitDashboardSessionUpdated;
    /**
     * 產生回饋頁面URL
     */
    private generateFeedbackUrl;
    /**
     * 開啟回饋頁面
     */
    private openFeedbackPage;
    /**
     * 產生會話ID
     */
    private generateSessionId;
    /**
     * 啟動Web伺服器
     */
    start(): Promise<void>;
    /**
     * 優雅停止Web伺服器
     */
    gracefulStop(): Promise<void>;
    /**
     * 停止Web伺服器
     */
    stop(): Promise<void>;
    /**
     * 檢查伺服器是否執行
     */
    isRunning(): boolean;
    /**
     * 取得伺服器連接埠
     */
    getPort(): number;
}
//# sourceMappingURL=web-server.d.ts.map