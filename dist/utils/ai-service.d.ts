/**
 * AI 整合服務
 * 使用 Google Gemini API 或 CLI 工具生成回覆
 */
import type { AIReplyRequest, AIReplyResponse } from '../types/index.js';
/**
 * 生成 AI 回覆
 * @param request AI 回覆請求
 * @returns AI 回覆響應
 */
export declare function generateAIReply(request: AIReplyRequest): Promise<AIReplyResponse>;
/**
 * 清除所有快取
 */
export declare function clearAICache(): void;
/**
 * 驗證 API Key
 * @param apiKey API Key
 * @param model 模型名稱
 * @returns 驗證結果
 */
export declare function validateAPIKey(apiKey: string, model: string): Promise<{
    valid: boolean;
    error?: string;
}>;
/**
 * 估算 API 成本
 * @param text 文字內容
 * @returns 預估的 token 數量
 */
export declare function estimateTokenCount(text: string): number;
//# sourceMappingURL=ai-service.d.ts.map