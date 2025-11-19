/**
 * user-feedback MCP Tools - Web服务器实现
 */
import { Config, FeedbackData } from '../types/index.js';
/**
 * Web服务器类
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
     * 解析静态资源目录，优先使用构建产物，其次回退到源码目录
     */
    private getStaticAssetsPath;
    /**
     * 等待所有活躍會話完成或達到最大等待時間。
     * 這是簡單的輪詢實作，檢查 sessionStorage.getSessionCount() 是否降為 0。
     */
    private waitForActiveSessions;
    /**
     * 设置优雅退出处理
     */
    private setupGracefulShutdown;
    /**
     * 设置中间件
     */
    private setupMiddleware;
    /**
     * 设置路由
     */
    private setupRoutes;
    /**
     * 设置Socket.IO事件处理
     */
    private setupSocketHandlers;
    /**
     * 处理反馈提交
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
     * 收集用户反馈
     */
    collectFeedback(workSummary: string, timeoutSeconds: number): Promise<{
        feedback: FeedbackData[];
        sessionId: string;
        feedbackUrl: string;
    }>;
    /**
     * 生成反馈页面URL
     */
    private generateFeedbackUrl;
    /**
     * 打开反馈页面
     */
    private openFeedbackPage;
    /**
     * 生成会话ID
     */
    private generateSessionId;
    /**
     * 启动Web服务器
     */
    start(): Promise<void>;
    /**
     * 优雅停止Web服务器
     */
    gracefulStop(): Promise<void>;
    /**
     * 停止Web服务器
     */
    stop(): Promise<void>;
    /**
     * 检查服务器是否运行
     */
    isRunning(): boolean;
    /**
     * 获取服务器端口
     */
    getPort(): number;
}
//# sourceMappingURL=web-server.d.ts.map