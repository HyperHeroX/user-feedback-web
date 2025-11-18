/**
 * AI 整合服務
 * 使用 Google Gemini API 生成回覆
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAISettings } from './database.js';
import type { AIReplyRequest, AIReplyResponse } from '../types/index.js';

// 重試配置
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 毫秒

// 快取配置
interface CacheEntry {
    reply: string;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分鐘

/**
 * 生成 AI 回覆
 * @param request AI 回覆請求
 * @returns AI 回覆響應
 */
export async function generateAIReply(request: AIReplyRequest): Promise<AIReplyResponse> {
    try {
        // 檢查快取
        const cacheKey = `${request.aiMessage}:${request.userContext || ''}`;
        const cached = cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return {
                success: true,
                reply: cached.reply
            };
        }

        // 獲取 AI 設定
        const settings = getAISettings();

        if (!settings || !settings.apiKey || settings.apiKey === 'YOUR_API_KEY_HERE') {
            return {
                success: false,
                error: '請先在設定中配置 AI API Key'
            };
        }

        // 生成回覆（帶重試機制）
        const reply = await generateWithRetry(
            settings.apiKey,
            settings.model,
            settings.systemPrompt,
            request.aiMessage,
            request.userContext,
            settings.temperature,
            settings.maxTokens
        );

        // 存入快取
        cache.set(cacheKey, {
            reply,
            timestamp: Date.now()
        });

        // 清理過期快取
        cleanExpiredCache();

        return {
            success: true,
            reply
        };
    } catch (error) {
        console.error('AI service error:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : '未知錯誤'
        };
    }
}

/**
 * 帶重試機制的 AI 生成
 */
async function generateWithRetry(
    apiKey: string,
    model: string,
    systemPrompt: string,
    aiMessage: string,
    userContext?: string,
    temperature?: number,
    maxTokens?: number,
    retryCount: number = 0
): Promise<string> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const generativeModel = genAI.getGenerativeModel({
            model,
            generationConfig: {
                temperature: temperature ?? 0.7,
                maxOutputTokens: maxTokens ?? 1000,
            }
        });

        // 構建提示詞
        const prompt = buildPrompt(systemPrompt, aiMessage, userContext);

        // 生成內容
        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
            throw new Error('AI 回覆為空');
        }

        return text;
    } catch (error) {
        // 處理錯誤
        if (error instanceof Error) {
            // 檢查是否為速率限制錯誤
            if (error.message.includes('429') || error.message.includes('quota')) {
                if (retryCount < MAX_RETRIES) {
                    // 等待後重試
                    const delay = RETRY_DELAYS[retryCount] || 4000;
                    await sleep(delay);
                    return generateWithRetry(
                        apiKey,
                        model,
                        systemPrompt,
                        aiMessage,
                        userContext,
                        temperature,
                        maxTokens,
                        retryCount + 1
                    );
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
                return generateWithRetry(
                    apiKey,
                    model,
                    systemPrompt,
                    aiMessage,
                    userContext,
                    temperature,
                    maxTokens,
                    retryCount + 1
                );
            }
        }

        throw error;
    }
}

/**
 * 構建提示詞
 */
function buildPrompt(systemPrompt: string, aiMessage: string, userContext?: string): string {
    let prompt = `${systemPrompt}\n\n`;
    prompt += `AI 工作匯報：\n${aiMessage}\n\n`;

    if (userContext) {
        prompt += `使用者上下文：\n${userContext}\n\n`;
    }

    prompt += '請生成一個簡潔、專業的回應：';

    return prompt;
}

/**
 * 延遲函數
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 清理過期快取
 */
function cleanExpiredCache(): void {
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
export function clearAICache(): void {
    cache.clear();
}

/**
 * 驗證 API Key
 * @param apiKey API Key
 * @param model 模型名稱
 * @returns 驗證結果
 */
export async function validateAPIKey(apiKey: string, model: string): Promise<{ valid: boolean; error?: string }> {
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
    } catch (error) {
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
export function estimateTokenCount(text: string): number {
    // 簡單估算：英文約 4 字元 = 1 token，中文約 2 字元 = 1 token
    const englishChars = (text.match(/[a-zA-Z0-9]/g) || []).length;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - englishChars - chineseChars;

    return Math.ceil(englishChars / 4 + chineseChars / 2 + otherChars / 3);
}

