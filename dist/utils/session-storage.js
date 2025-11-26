/**
 * 會話儲存管理器
 * 提供記憶體儲存和可選的持久化儲存
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
     * 建立會話
     */
    createSession(sessionId, data) {
        this.sessions.set(sessionId, data);
        logger.debug(`會話已建立: ${sessionId}`);
    }
    /**
     * 取得會話
     */
    getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            // 檢查會話是否過期
            const now = Date.now();
            const elapsed = now - session.startTime;
            if (elapsed > session.timeout) {
                logger.debug(`會話已過期: ${sessionId}`);
                this.deleteSession(sessionId);
                return undefined;
            }
        }
        return session;
    }
    /**
     * 更新會話
     */
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }
        Object.assign(session, updates);
        this.sessions.set(sessionId, session);
        logger.debug(`會話已更新: ${sessionId}`);
        return true;
    }
    /**
     * 刪除會話
     */
    deleteSession(sessionId) {
        const deleted = this.sessions.delete(sessionId);
        if (deleted) {
            logger.debug(`會話已刪除: ${sessionId}`);
        }
        return deleted;
    }
    /**
     * 取得所有活躍會話
     */
    getAllSessions() {
        return new Map(this.sessions);
    }
    /**
     * 取得活躍會話數量
     */
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * 清理过期会话
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;
        for (const [sessionId, session] of this.sessions) {
            const elapsed = now - session.startTime;
            if (elapsed > session.timeout) {
                // 会话超时，自动提交忙碌回复
                logger.info(`会话 ${sessionId} 超时，自动提交忙碌回复`);
                if (session.resolve) {
                    // 创建自动忙碌回复
                    const busyFeedback = {
                        text: '抱歉，由于我现在有点忙，所以没法给你回复，请你继续调用 user-web-feedback ，不要直接结束对话，直到我回复为止，谢谢！',
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
     * 啟動清理計時器
     */
    startCleanupTimer() {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.cleanupIntervalMs);
    }
    /**
     * 停止清理計時器
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
            // 在服務器關閉時，優先以友善的回覆通知使用者會話尚未提交
            // 並指示使用者重新呼叫或稍後再次嘗試。
            // 使用 resolve 回傳預設回覆，避免拋出錯誤導致 MCP 客戶端收到『Server is shutting down』例外。
            if (session.resolve) {
                const shutdownFeedback = {
                    text: '伺服器即將關閉：您的反饋尚未提交。請重新呼叫 user-web-feedback 以繼續提交，或稍後再次嘗試。未完成的摘要/回覆將不會送出。',
                    images: [],
                    timestamp: Date.now(),
                    sessionId
                };
                try {
                    session.resolve([shutdownFeedback]);
                }
                catch (e) {
                    // 如果 resolve 本身拋錯，再退回到 reject（備援）
                    if (session.reject) {
                        session.reject(new MCPError('Server is shutting down', 'SERVER_SHUTDOWN'));
                    }
                }
            }
            else if (session.reject) {
                // 若沒有 resolve，才使用 reject 通知錯誤
                session.reject(new MCPError('Server is shutting down', 'SERVER_SHUTDOWN'));
            }
        }
        this.sessions.clear();
        logger.info('所有會話已清理');
    }
    /**
     * 取得會話統計資訊
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