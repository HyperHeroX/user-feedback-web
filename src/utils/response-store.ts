import crypto from 'crypto';
import { savePendingResponse, getPendingResponseByProject, getPendingResponseById, markPendingResponseDelivered, incrementDeliveryAttempt, cleanupExpiredPendingResponses } from './database.js';
import { logger } from './logger.js';
import type { FeedbackData } from '../types/index.js';

export interface PendingResponse {
  id: string;
  sessionId: string;
  projectId: string;
  projectName: string;
  feedback: FeedbackData[];
  feedbackUrl: string;
  createdAt: number;
}

export class ResponseStore {
  private ttlSeconds: number;

  constructor(ttlSeconds: number = 86400) {
    this.ttlSeconds = ttlSeconds;
  }

  save(params: {
    sessionId: string;
    projectId: string;
    projectName: string;
    feedback: FeedbackData[];
    feedbackUrl: string;
  }): string {
    const id = crypto.randomUUID();
    savePendingResponse({
      id,
      sessionId: params.sessionId,
      projectId: params.projectId,
      projectName: params.projectName,
      feedbackJson: JSON.stringify(params.feedback),
      feedbackUrl: params.feedbackUrl,
      ttlSeconds: this.ttlSeconds,
    });
    logger.info(`[ResponseStore] 已持久化回應 id=${id}, project=${params.projectId}, session=${params.sessionId}`);
    return id;
  }

  getByProject(projectId: string): PendingResponse | null {
    const row = getPendingResponseByProject(projectId);
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      projectId: row.project_id,
      projectName: row.project_name,
      feedback: JSON.parse(row.feedback_json) as FeedbackData[],
      feedbackUrl: row.feedback_url,
      createdAt: row.created_at,
    };
  }

  getById(id: string): PendingResponse | null {
    const row = getPendingResponseById(id);
    if (!row || row.delivered) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      projectId: row.project_id,
      projectName: row.project_name,
      feedback: JSON.parse(row.feedback_json) as FeedbackData[],
      feedbackUrl: row.feedback_url,
      createdAt: row.created_at,
    };
  }

  markDelivered(id: string): void {
    markPendingResponseDelivered(id);
    logger.info(`[ResponseStore] 回應已標記為已送達 id=${id}`);
  }

  incrementAttempt(id: string): void {
    incrementDeliveryAttempt(id);
  }

  cleanup(): number {
    const count = cleanupExpiredPendingResponses();
    if (count > 0) {
      logger.info(`[ResponseStore] 已清理 ${count} 筆過期回應`);
    }
    return count;
  }
}
