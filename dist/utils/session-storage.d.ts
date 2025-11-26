/**
 * 會話儲存管理器
 * 提供記憶體儲存和可選的持久化儲存
 */
import { FeedbackData } from '../types/index.js';
export interface SessionData {
    workSummary: string;
    feedback: FeedbackData[];
    startTime: number;
    timeout: number;
    resolve?: (feedback: FeedbackData[]) => void;
    reject?: (error: Error) => void;
}
export declare class SessionStorage {
    private cleanupIntervalMs;
    private sessions;
    private cleanupInterval;
    constructor(cleanupIntervalMs?: number);
    /**
     * 建立會話
     */
    createSession(sessionId: string, data: SessionData): void;
    /**
     * 取得會話
     */
    getSession(sessionId: string): SessionData | undefined;
    /**
     * 更新會話
     */
    updateSession(sessionId: string, updates: Partial<SessionData>): boolean;
    /**
     * 刪除會話
     */
    deleteSession(sessionId: string): boolean;
    /**
     * 取得所有活躍會話
     */
    getAllSessions(): Map<string, SessionData>;
    /**
     * 取得活躍會話數量
     */
    getSessionCount(): number;
    /**
     * 清理过期会话
     */
    cleanupExpiredSessions(): number;
    /**
     * 啟動清理計時器
     */
    private startCleanupTimer;
    /**
     * 停止清理計時器
     */
    stopCleanupTimer(): void;
    /**
     * 清理所有会话
     */
    clear(): void;
    /**
     * 取得會話統計資訊
     */
    getStats(): {
        totalSessions: number;
        activeSessions: number;
        expiredSessions: number;
    };
}
//# sourceMappingURL=session-storage.d.ts.map