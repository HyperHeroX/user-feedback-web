/**
 * 会话存储管理器
 * 提供内存存储和可选的持久化存储
 */

import { logger } from './logger.js';
import { MCPError, FeedbackData } from '../types/index.js';

export interface SessionData {
  workSummary: string;
  feedback: FeedbackData[];
  startTime: number;
  timeout: number;
  resolve?: (feedback: FeedbackData[]) => void;
  reject?: (error: Error) => void;
}

export class SessionStorage {
  private sessions = new Map<string, SessionData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private cleanupIntervalMs: number = 60000) { // 1分钟清理一次
    this.startCleanupTimer();
  }

  /**
   * 创建会话
   */
  createSession(sessionId: string, data: SessionData): void {
    this.sessions.set(sessionId, data);
    logger.debug(`会话已创建: ${sessionId}`);
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): SessionData | undefined {
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
  updateSession(sessionId: string, updates: Partial<SessionData>): boolean {
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
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug(`会话已删除: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * 获取所有活跃会话
   */
  getAllSessions(): Map<string, SessionData> {
    return new Map(this.sessions);
  }

  /**
   * 获取活跃会话数量
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const elapsed = now - session.startTime;

      if (elapsed > session.timeout) {
        // 会话超时，自动提交忙碌回复
        logger.info(`会话 ${sessionId} 超时，自动提交忙碌回复`);

        if (session.resolve) {
          // 创建自动忙碌回复
          const busyFeedback: FeedbackData = {
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
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.cleanupIntervalMs);
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 清理所有会话
   */
  clear(): void {
    // 通知所有会话关闭
    for (const [sessionId, session] of this.sessions) {
      // 在服務器關閉時，優先以友善的回覆通知使用者會話尚未提交
      // 並指示使用者重新呼叫或稍後再次嘗試。
      // 使用 resolve 回傳預設回覆，避免拋出錯誤導致 MCP 客戶端收到『Server is shutting down』例外。
      if (session.resolve) {
        const shutdownFeedback: FeedbackData = {
          text: '伺服器即將關閉：您的反饋尚未提交。請重新呼叫 user-web-feedback 以繼續提交，或稍後再次嘗試。未完成的摘要/回覆將不會送出。',
          images: [],
          timestamp: Date.now(),
          sessionId
        };

        try {
          session.resolve([shutdownFeedback]);
        } catch (e) {
          // 如果 resolve 本身拋錯，再退回到 reject（備援）
          if (session.reject) {
            session.reject(new MCPError('Server is shutting down', 'SERVER_SHUTDOWN'));
          }
        }
      } else if (session.reject) {
        // 若沒有 resolve，才使用 reject 通知錯誤
        session.reject(new MCPError('Server is shutting down', 'SERVER_SHUTDOWN'));
      }
    }

    this.sessions.clear();
    logger.info('所有会话已清理');
  }

  /**
   * 获取会话统计信息
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const session of this.sessions.values()) {
      const elapsed = now - session.startTime;
      if (elapsed > session.timeout) {
        expiredSessions++;
      } else {
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
