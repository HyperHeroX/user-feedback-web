/**
 * AI Provider Factory
 * 工廠模式實作 - 根據設定創建 API 或 CLI Provider
 */
import { getCLISettings } from './database.js';
import { logger } from './logger.js';
import { APIProvider } from './api-provider.js';
import { CLIProvider } from './cli-provider.js';
/**
 * AI Provider 工廠類別
 */
export class AIProviderFactory {
    static instance;
    currentProvider = null;
    fallbackProvider = null;
    constructor() { }
    /**
     * 取得工廠實例 (Singleton)
     */
    static getInstance() {
        if (!AIProviderFactory.instance) {
            AIProviderFactory.instance = new AIProviderFactory();
        }
        return AIProviderFactory.instance;
    }
    /**
     * 根據設定取得適當的 Provider
     */
    async getProvider() {
        const cliSettings = getCLISettings();
        const mode = cliSettings?.aiMode === 'cli' ? 'cli' : 'api';
        logger.debug('[AIProviderFactory] 取得 Provider', { mode, cliTool: cliSettings?.cliTool });
        if (mode === 'cli') {
            const cliProvider = new CLIProvider(cliSettings);
            const available = await cliProvider.isAvailable();
            if (!available) {
                logger.warn('[AIProviderFactory] CLI Provider 不可用');
                if (cliSettings?.cliFallbackToApi) {
                    logger.info('[AIProviderFactory] 回退到 API Provider');
                    return new APIProvider();
                }
                throw new Error(`CLI 工具 ${cliSettings?.cliTool} 不可用，且未啟用 API 回退`);
            }
            return cliProvider;
        }
        return new APIProvider();
    }
    /**
     * 取得當前模式
     */
    getCurrentMode() {
        const cliSettings = getCLISettings();
        return cliSettings?.aiMode === 'cli' ? 'cli' : 'api';
    }
    /**
     * 取得當前 CLI 工具名稱
     */
    getCurrentCLITool() {
        const cliSettings = getCLISettings();
        return cliSettings?.cliTool;
    }
    /**
     * 使用工廠生成 AI 回覆
     */
    async generateReply(request) {
        try {
            const provider = await this.getProvider();
            logger.info(`[AIProviderFactory] 使用 ${provider.getName()} 生成回覆`);
            return provider.generateReply(request);
        }
        catch (error) {
            logger.error('[AIProviderFactory] 生成回覆失敗', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '未知錯誤'
            };
        }
    }
}
/**
 * 取得 AI Provider 工廠實例
 */
export function getAIProviderFactory() {
    return AIProviderFactory.getInstance();
}
//# sourceMappingURL=ai-provider-factory.js.map