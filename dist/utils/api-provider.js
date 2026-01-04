/**
 * API Provider
 * 使用 Google Gemini API 生成 AI 回覆
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAISettings, getCLISettings } from './database.js';
import { logger } from './logger.js';
import { mcpClientManager } from './mcp-client-manager.js';
import { getPromptAggregator } from './prompt-aggregator/index.js';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
export class APIProvider {
    getName() {
        return 'Google Gemini API';
    }
    getMode() {
        return 'api';
    }
    async isAvailable() {
        const settings = getAISettings();
        return !!(settings?.apiKey && settings.apiKey !== 'YOUR_API_KEY_HERE');
    }
    async generateReply(request) {
        try {
            const cacheKey = `${request.aiMessage}:${request.userContext || ''}`;
            if (!request.toolResults) {
                const cached = cache.get(cacheKey);
                if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                    logger.debug('[APIProvider] 使用快取回覆');
                    return { success: true, reply: cached.reply, mode: 'api' };
                }
            }
            const settings = getAISettings();
            if (!settings || !settings.apiKey || settings.apiKey === 'YOUR_API_KEY_HERE') {
                logger.warn('[APIProvider] API Key 未設定或無效');
                return { success: false, error: '請先在設定中配置 AI API Key', mode: 'api' };
            }
            const aggregator = getPromptAggregator();
            const cliSettings = getCLISettings();
            let mcpTools = [];
            if (request.includeMCPTools) {
                try {
                    const allTools = mcpClientManager.getAllTools();
                    mcpTools = allTools.map(tool => ({
                        name: tool.name,
                        description: tool.description,
                        inputSchema: tool.inputSchema
                    }));
                }
                catch (error) {
                    logger.warn('[APIProvider] 無法取得 MCP 工具', error);
                }
            }
            const context = aggregator.buildContextSync(request, settings, cliSettings, mcpTools);
            context.mode = 'api';
            const aggregated = aggregator.aggregate(context);
            const promptSent = aggregated.fullPrompt;
            const reply = await this.generateWithRetry(settings.apiKey, settings.model, promptSent, settings.temperature, settings.maxTokens);
            if (!request.toolResults) {
                cache.set(cacheKey, { reply, timestamp: Date.now() });
                this.cleanExpiredCache();
            }
            return { success: true, reply, promptSent, mode: 'api' };
        }
        catch (error) {
            logger.error('[APIProvider] 生成回覆失敗', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : '未知錯誤',
                mode: 'api'
            };
        }
    }
    async generateWithRetry(apiKey, model, prompt, temperature, maxTokens, retryCount = 0) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const generativeModel = genAI.getGenerativeModel({
                model,
                generationConfig: {
                    temperature: temperature ?? 0.7,
                    maxOutputTokens: maxTokens ?? 1000,
                }
            });
            const result = await generativeModel.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            if (!text)
                throw new Error('AI 回覆為空');
            return text;
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('429') || error.message.includes('quota')) {
                    if (retryCount < MAX_RETRIES) {
                        await this.sleep(RETRY_DELAYS[retryCount] || 4000);
                        return this.generateWithRetry(apiKey, model, prompt, temperature, maxTokens, retryCount + 1);
                    }
                    throw new Error('API 配額已用盡或速率限制，請稍後再試');
                }
                if (error.message.includes('API key') || error.message.includes('401')) {
                    throw new Error('API Key 無效，請檢查設定');
                }
                if (retryCount < MAX_RETRIES) {
                    await this.sleep(RETRY_DELAYS[retryCount] || 4000);
                    return this.generateWithRetry(apiKey, model, prompt, temperature, maxTokens, retryCount + 1);
                }
            }
            throw error;
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, entry] of cache.entries()) {
            if (now - entry.timestamp > CACHE_TTL)
                cache.delete(key);
        }
    }
}
//# sourceMappingURL=api-provider.js.map