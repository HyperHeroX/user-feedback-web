/**
 * 会话存储管理器
 * 提供内存存储和可选的持久化存储
 */
import { logger } from './logger.js';
import { MCPError } from '../types/index.js';
export class SessionStorage {
    cleanupIntervalMs;
    sessions = new Map();
    cleanupInterval = null;
    constructor(cleanupIntervalMs = 60000) {
        this.cleanupIntervalMs = cleanupIntervalMs;
        this.startCleanupTimer();
    }
    /**
     * 创建会话
     */
    createSession(sessionId, data) {
        this.sessions.set(sessionId, data);
        logger.debug(`会话已创建: ${sessionId}`);
    }
    /**
     * 获取会话
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            // 检查会话是否过期
            const now = Date.now();
            const elapsed = now - session.startTime;
            if (elapsed > session.timeout) {
                logger.debug(`会话已过期: ${sessionId}`);
                this.deleteSession(sessionId);
                return undefined;
            }
        }
        return session;
    }
    /**
     * 更新会话
     */
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }
        Object.assign(session, updates);
        this.sessions.set(sessionId, session);
        logger.debug(`会话已更新: ${sessionId}`);
        return true;
    }
    /**
     * 更新会话最后活动时间
     */
    updateLastActivity(sessionId) {
        return this.updateSession(sessionId, { lastActivityTime: Date.now() });
    }
    /**
     * 添加对话历史记录
     */
    addConversationTurn(sessionId, turn, maxHistory = 50) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }
        if (!session.conversationHistory) {
            session.conversationHistory = [];
        }
        // 限制历史记录长度
        if (session.conversationHistory.length >= maxHistory) {
            session.conversationHistory.shift(); // 移除最早的
        }
        session.conversationHistory.push(turn);
        this.sessions.set(sessionId, session);
        logger.debug(`会话 ${sessionId} 添加对话记录，类型: ${turn.type}`);
        return true;
    }
    /**
     * 删除会话
     */
    deleteSession(sessionId) {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            logger.debug(`会话已删除: ${sessionId}`);
        }
        return deleted;
    }
    /**
     * 获取所有活跃会话
     */
    getAllSessions() {
        return new Map(this.sessions);
    }
    /**
     * 获取活跃会话数量
     */
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * 清理过期会话
     */
    cleanupExpiredSessions(continuationActivityTimeout = 600000, // 10分钟无活动
    continuationAbsoluteTimeout = 3600000 // 1小时绝对上限
    ) {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [sessionId, session] of this.sessions) {
            let shouldExpire = false;
            if (session.continuationMode) {
                // 持续模式：检查活动超时和绝对超时
                const timeSinceActivity = now - (session.lastActivityTime || session.startTime);
                const timeSinceStart = now - session.startTime;
                shouldExpire =
                    timeSinceActivity > continuationActivityTimeout ||
                        timeSinceStart > continuationAbsoluteTimeout;
                if (shouldExpire) {
                    logger.info(`持续模式会话 ${sessionId} 超时 (活动: ${timeSinceActivity}ms, 总时长: ${timeSinceStart}ms)`);
                }
            }
            else {
                // 单次模式：现有逻辑
                const elapsed = now - session.startTime;
                shouldExpire = elapsed > session.timeout;
                if (shouldExpire) {
                    logger.info(`单次模式会话 ${sessionId} 超时`);
                }
            }
            if (shouldExpire) {
                // 会话超时，自动提交忙碌回复
                if (session.resolve) {
                    // 创建自动忙碌回复
                    const busyFeedback = {
                        text: "抱歉，由于我现在有点忙，所以没法给你回复，请你继续调用 user-web-feedback ，不要直接结束对话，直到我回复为止，谢谢！",
                        images: [],
                        timestamp: Date.now(),
                        sessionId: sessionId
                    };
                    // 返回忙碌回复而不是错误
                    session.resolve([busyFeedback]);
                }
                this.sessions.delete(sessionId);
                cleanedCount++;
                logger.debug(`清理过期会话: ${sessionId}`);
            }
        }
        if (cleanedCount > 0) {
            logger.info(`清理了 ${cleanedCount} 个过期会话`);
        }
        return cleanedCount;
    }
    /**
     * 启动清理定时器
     */
    startCleanupTimer() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.cleanupIntervalMs);
    }
    /**
     * 停止清理定时器
     */
    stopCleanupTimer() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
    /**
     * 清理所有会话
     */
    clear() {
        // 通知所有会话关闭
        for (const [sessionId, session] of this.sessions) {
            if (session.reject) {
                session.reject(new MCPError('Server is shutting down', 'SERVER_SHUTDOWN'));
            }
        }
        this.sessions.clear();
        logger.info('所有会话已清理');
    }
    /**
     * 获取会话统计信息
     */
    getStats() {
        const now = Date.now();
        let activeSessions = 0;
        let expiredSessions = 0;
        for (const session of this.sessions.values()) {
            const elapsed = now - session.startTime;
            if (elapsed > session.timeout) {
                expiredSessions++;
            }
            else {
                activeSessions++;
            }
        }
        return {
            totalSessions: this.sessions.size,
            activeSessions,
            expiredSessions
        };
    }
}
//# sourceMappingURL=session-storage.js.map