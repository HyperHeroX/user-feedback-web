/**
 * AI Provider Factory
 * 工廠模式實作 - 根據設定創建 API 或 CLI Provider
 */
import type { IAIProvider, AIProviderMode } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse } from '../types/index.js';
/**
 * AI Provider 工廠類別
 */
export declare class AIProviderFactory {
    private static instance;
    private currentProvider;
    private fallbackProvider;
    private constructor();
    /**
     * 取得工廠實例 (Singleton)
     */
    static getInstance(): AIProviderFactory;
    /**
     * 根據設定取得適當的 Provider
     */
    getProvider(): Promise<IAIProvider>;
    /**
     * 取得當前模式
     */
    getCurrentMode(): AIProviderMode;
    /**
     * 取得當前 CLI 工具名稱
     */
    getCurrentCLITool(): string | undefined;
    /**
     * 使用工廠生成 AI 回覆
     */
    generateReply(request: AIReplyRequest): Promise<AIReplyResponse>;
}
/**
 * 取得 AI Provider 工廠實例
 */
export declare function getAIProviderFactory(): AIProviderFactory;
//# sourceMappingURL=ai-provider-factory.d.ts.map