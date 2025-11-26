/**
 * user-feedback MCP Tools - 效能監控工具
 */
/**
 * 效能指標介面
 */
export interface PerformanceMetrics {
    memoryUsage: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
    };
    cpuUsage: {
        user: number;
        system: number;
    };
    uptime: number;
    requestStats: {
        total: number;
        successful: number;
        failed: number;
        averageResponseTime: number;
    };
    websocketStats: {
        activeConnections: number;
        totalConnections: number;
        messagesReceived: number;
        messagesSent: number;
    };
    sessionStats: {
        activeSessions: number;
        totalSessions: number;
        completedSessions: number;
        timeoutSessions: number;
    };
}
/**
 * 效能監控器類別
 */
export declare class PerformanceMonitor {
    private startTime;
    private requestStats;
    private websocketStats;
    private sessionStats;
    constructor();
    /**
     * 記錄HTTP請求
     */
    recordRequest(responseTime: number, success: boolean): void;
    /**
     * 記錄WebSocket連線
     */
    recordWebSocketConnection(): void;
    /**
     * 記錄WebSocket斷開連線
     */
    recordWebSocketDisconnection(): void;
    /**
     * 記錄WebSocket訊息
     */
    recordWebSocketMessage(direction: 'received' | 'sent'): void;
    /**
     * 記錄會話建立
     */
    recordSessionCreated(): void;
    /**
     * 記錄會話完成
     */
    recordSessionCompleted(): void;
    /**
     * 記錄會話逾時
     */
    recordSessionTimeout(): void;
    /**
     * 取得目前效能指標
     */
    getMetrics(): PerformanceMetrics;
    /**
     * 計算平均回應時間
     */
    private calculateAverageResponseTime;
    /**
     * 取得格式化的效能報告
     */
    getFormattedReport(): string;
    /**
     * 檢查效能警告
     */
    checkPerformanceWarnings(): string[];
    /**
     * 啟動定期效能監控
     */
    startPeriodicMonitoring(intervalMs?: number): NodeJS.Timeout;
    /**
     * 重置統計資料
     */
    reset(): void;
}
export declare const performanceMonitor: PerformanceMonitor;
//# sourceMappingURL=performance-monitor.d.ts.map