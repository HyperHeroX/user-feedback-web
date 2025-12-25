/**
 * AI 整合服務
 * 使用 Google Gemini API 生成回覆
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAISettings } from './database.js';
import { logger } from './logger.js';
import { buildToolsPrompt } from './mcp-tool-parser.js';
import { mcpClientManager } from './mcp-client-manager.js';
// 重試配置
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 毫秒
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘
/**
 * 生成 AI 回覆
 * @param request AI 回覆請求
 * @returns AI 回覆響應
 */
export async function generateAIReply(request) {
    try {
        logger.debug('[AI Service] 開始處理 AI 回覆請求', {
            includeMCPTools: request.includeMCPTools,
            hasToolResults: !!request.toolResults,
            projectName: request.projectName,
            projectPath: request.projectPath
        });
        // 檢查快取（不包含工具結果時才使用）
        const cacheKey = `${request.aiMessage}:${request.userContext || ''}`;
        if (!request.toolResults) {
            const cached = cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                logger.debug('[AI Service] 使用快取回覆');
                return {
                    success: true,
                    reply: cached.reply
                };
            }
        }
        // 獲取 AI 設定
        logger.debug('[AI Service] 獲取 AI 設定');
        const settings = getAISettings();
        logger.debug('[AI Service] AI 設定獲取完成', {
            hasApiKey: !!settings?.apiKey,
            model: settings?.model,
            hasMcpToolsPrompt: !!settings?.mcpToolsPrompt
        });
        if (!settings || !settings.apiKey || settings.apiKey === 'YOUR_API_KEY_HERE') {
            logger.warn('[AI Service] API Key 未設定或無效');
            return {
                success: false,
                error: '請先在設定中配置 AI API Key'
            };
        }
        // 獲取 MCP 工具描述（如果啟用）
        let mcpToolsPrompt = '';
        if (request.includeMCPTools) {
            logger.debug('[AI Service] 開始獲取 MCP 工具');
            try {
                const allTools = mcpClientManager.getAllTools();
                logger.debug('[AI Service] MCP 工具獲取完成', {
                    toolCount: allTools.length
                });
                // 優先使用資料庫中的自定義 MCP 工具提示詞
                if (settings.mcpToolsPrompt) {
                    logger.debug('[AI Service] 使用資料庫中的 MCP 工具提示詞');
                    // 替換佔位符
                    mcpToolsPrompt = settings.mcpToolsPrompt
                        .replace(/\{project_name\}/g, request.projectName || '未命名專案')
                        .replace(/\{project_path\}/g, request.projectPath || '');
                    // 附加工具列表
                    if (allTools.length > 0) {
                        logger.debug('[AI Service] 附加工具列表到提示詞');
                        mcpToolsPrompt += '\n\n## 可用工具列表\n\n';
                        for (const tool of allTools) {
                            mcpToolsPrompt += `### ${tool.name}\n`;
                            if (tool.description) {
                                mcpToolsPrompt += `${tool.description}\n`;
                            }
                            if (tool.inputSchema) {
                                mcpToolsPrompt += '\n參數格式:\n```json\n';
                                mcpToolsPrompt += JSON.stringify(tool.inputSchema, null, 2);
                                mcpToolsPrompt += '\n```\n';
                            }
                            mcpToolsPrompt += '\n';
                        }
                    }
                }
                else {
                    logger.debug('[AI Service] 使用預設的 buildToolsPrompt');
                    // 使用預設的 buildToolsPrompt
                    mcpToolsPrompt = buildToolsPrompt(allTools, request.projectName, request.projectPath);
                }
            }
            catch (error) {
                logger.warn('[AI Service] Failed to get MCP tools for AI prompt', error);
            }
        }
        // 生成回覆（帶重試機制）
        logger.debug('[AI Service] 開始生成回覆', {
            hasSystemPrompt: !!settings.systemPrompt,
            hasMcpToolsPrompt: !!mcpToolsPrompt,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens
        });
        const reply = await generateWithRetry(settings.apiKey, settings.model, settings.systemPrompt, request.aiMessage, request.userContext, settings.temperature, settings.maxTokens, 0, mcpToolsPrompt, request.toolResults);
        logger.debug('[AI Service] 回覆生成完成', {
            replyLength: reply.length
        });
        // 存入快取（不包含工具結果時）
        if (!request.toolResults) {
            cache.set(cacheKey, {
                reply,
                timestamp: Date.now()
            });
            // 清理過期快取
            cleanExpiredCache();
        }
        logger.debug('[AI Service] AI 回覆請求處理完成');
        return {
            success: true,
            reply
        };
    }
    catch (error) {
        logger.error('[AI Service] AI service error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '未知錯誤'
        };
    }
}
/**
 * 帶重試機制的 AI 生成
 */
async function generateWithRetry(apiKey, model, systemPrompt, aiMessage, userContext, temperature, maxTokens, retryCount = 0, mcpToolsPrompt = '', toolResults) {
    try {
        logger.debug('[AI Service] generateWithRetry 開始', {
            model,
            retryCount,
            hasSystemPrompt: !!systemPrompt,
            hasMcpToolsPrompt: !!mcpToolsPrompt,
            hasToolResults: !!toolResults,
            temperature,
            maxTokens
        });
        const genAI = new GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({
            model,
            generationConfig: {
                temperature: temperature ?? 0.7,
                maxOutputTokens: maxTokens ?? 1000,
            }
        });
        // 構建提示詞
        logger.debug('[AI Service] 構建提示詞');
        const prompt = buildPrompt(systemPrompt, aiMessage, userContext, mcpToolsPrompt, toolResults);
        logger.debug('[AI Service] 提示詞構建完成', {
            promptLength: prompt.length
        });
        // 生成內容
        logger.debug('[AI Service] 開始調用 Google Gemini API');
        const result = await generativeModel.generateContent(prompt);
        logger.debug('[AI Service] API 調用完成');
        const response = await result.response;
        const text = response.text();
        if (!text) {
            throw new Error('AI 回覆為空');
        }
        logger.debug('[AI Service] 回覆文字獲取成功', {
            textLength: text.length
        });
        return text;
    }
    catch (error) {
        logger.debug('[AI Service] generateWithRetry 發生錯誤', {
            error: error instanceof Error ? error.message : String(error),
            retryCount
        });
        // 處理錯誤
        if (error instanceof Error) {
            // 檢查是否為速率限制錯誤
            if (error.message.includes('429') || error.message.includes('quota')) {
                if (retryCount < MAX_RETRIES) {
                    // 等待後重試
                    const delay = RETRY_DELAYS[retryCount] || 4000;
                    await sleep(delay);
                    return generateWithRetry(apiKey, model, systemPrompt, aiMessage, userContext, temperature, maxTokens, retryCount + 1, mcpToolsPrompt, toolResults);
                }
                throw new Error('API 配額已用盡或速率限制，請稍後再試');
            }
            // 檢查是否為 API Key 錯誤
            if (error.message.includes('API key') || error.message.includes('401')) {
                throw new Error('API Key 無效，請檢查設定');
            }
            // 其他錯誤重試
            if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[retryCount] || 4000;
                await sleep(delay);
                return generateWithRetry(apiKey, model, systemPrompt, aiMessage, userContext, temperature, maxTokens, retryCount + 1, mcpToolsPrompt, toolResults);
            }
        }
        throw error;
    }
}
/**
 * 構建提示詞
 */
function buildPrompt(systemPrompt, aiMessage, userContext, mcpToolsPrompt = '', toolResults) {
    let prompt = `${systemPrompt}\n\n`;
    if (mcpToolsPrompt) {
        prompt += mcpToolsPrompt + '\n\n';
    }
    prompt += `AI 工作匯報：\n${aiMessage}\n\n`;
    if (userContext) {
        prompt += `使用者上下文：\n${userContext}\n\n`;
    }
    if (toolResults) {
        prompt += `先前工具執行結果：\n${toolResults}\n\n`;
    }
    prompt += '請生成一個簡潔、專業的回應：';
    return prompt;
}
/**
 * 延遲函數
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * 清理過期快取
 */
function cleanExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
}
/**
 * 清除所有快取
 */
export function clearAICache() {
    cache.clear();
}
/**
 * 驗證 API Key
 * @param apiKey API Key
 * @param model 模型名稱
 * @returns 驗證結果
 */
export async function validateAPIKey(apiKey, model) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({ model });
        // 發送測試請求
        const result = await generativeModel.generateContent('Hello');
        const response = await result.response;
        const text = response.text();
        if (text) {
            return { valid: true };
        }
        return { valid: false, error: '無法生成回應' };
    }
    catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : '未知錯誤'
        };
    }
}
/**
 * 估算 API 成本
 * @param text 文字內容
 * @returns 預估的 token 數量
 */
export function estimateTokenCount(text) {
    // 簡單估算：英文約 4 字元 = 1 token，中文約 2 字元 = 1 token
    const englishChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - englishChars - chineseChars;
    return Math.ceil(englishChars / 4 + chineseChars / 2 + otherChars / 3);
}
//# sourceMappingURL=ai-service.js.map