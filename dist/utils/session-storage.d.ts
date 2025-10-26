/**
 * 会话存储管理器
 * 提供内存存储和可选的持久化存储
 */
import { FeedbackData, SessionStatus, ConversationTurn } from '../types/index.js';
export interface SessionData {
    workSummary: string;
    feedback: FeedbackData[];
    startTime: number;
    timeout: number;
    resolve?: (feedback: FeedbackData[]) => void;
    reject?: (error: Error) => void;
    continuationMode?: boolean;
    status?: SessionStatus;
    lastActivityTime?: number;
    conversationHistory?: ConversationTurn[];
}
export declare class SessionStorage {
    private cleanupIntervalMs;
    private sessions;
    private cleanupInterval;
    constructor(cleanupIntervalMs?: number);
    /**
     * 创建会话
     */
    createSession(sessionId: string, data: SessionData): void;
    /**
     * 获取会话
     */
    getSession(sessionId: string): SessionData | undefined;
    /**
     * 更新会话
     */
    updateSession(sessionId: string, updates: Partial<SessionData>): boolean;
    /**
     * 更新会话最后活动时间
     */
    updateLastActivity(sessionId: string): boolean;
    /**
     * 添加对话历史记录
     */
    addConversationTurn(sessionId: string, turn: ConversationTurn, maxHistory?: number): boolean;
    /**
     * 删除会话
     */
    deleteSession(sessionId: string): boolean;
    /**
     * 获取所有活跃会话
     */
    getAllSessions(): Map<string, SessionData>;
    /**
     * 获取活跃会话数量
     */
    getSessionCount(): number;
    /**
     * 清理过期会话
     */
    cleanupExpiredSessions(continuationActivityTimeout?: number, // 10分钟无活动
    continuationAbsoluteTimeout?: number): number;
    /**
     * 启动清理定时器
     */
    private startCleanupTimer;
    /**
     * 停止清理定时器
     */
    stopCleanupTimer(): void;
    /**
     * 清理所有会话
     */
    clear(): void;
    /**
     * 获取会话统计信息
     */
    getStats(): {
        totalSessions: number;
        activeSessions: number;
        expiredSessions: number;
    };
}
//# sourceMappingURL=session-storage.d.ts.map