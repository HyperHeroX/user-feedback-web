/**
 * API Provider
 * 使用 Google Gemini API 生成 AI 回覆
 */
import type { IAIProvider, AIProviderMode } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse } from '../types/index.js';
export declare class APIProvider implements IAIProvider {
    getName(): string;
    getMode(): AIProviderMode;
    isAvailable(): Promise<boolean>;
    generateReply(request: AIReplyRequest): Promise<AIReplyResponse>;
    private buildPrompt;
    private generateWithRetry;
    private sleep;
    private cleanExpiredCache;
}
//# sourceMappingURL=api-provider.d.ts.map