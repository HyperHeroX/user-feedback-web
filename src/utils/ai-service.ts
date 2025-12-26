/**
 * AI 整合服務
 * 使用 Google Gemini API 或 CLI 工具生成回覆
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAISettings, getCLISettings, createCLITerminal, insertCLIExecutionLog, updateCLITerminal, getCLITerminalById } from './database.js';
import { logger } from './logger.js';
import type { AIReplyRequest, AIReplyResponse, CLISettings } from '../types/index.js';
import { buildToolsPrompt } from './mcp-tool-parser.js';
import { mcpClientManager } from './mcp-client-manager.js';
import { executeCLI } from './cli-executor.js';
import { isToolAvailable } from './cli-detector.js';
import { randomUUID } from 'crypto';

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
        logger.debug('[AI Service] 開始處理 AI 回覆請求', {
            includeMCPTools: request.includeMCPTools,
            hasToolResults: !!request.toolResults,
            projectName: request.projectName,
            projectPath: request.projectPath
        });

        // 檢查 CLI 模式設定
        const cliSettings = getCLISettings();
        if (cliSettings?.aiMode === 'cli') {
            logger.info('[AI Service] 使用 CLI 模式生成回覆');
            return generateCLIReply(request, cliSettings);
        }

        // 以下為 API 模式
        return generateAPIReply(request);
    } catch (error) {
        logger.error('[AI Service] AI service error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '未知錯誤'
        };
    }
}

/**
 * 使用 CLI 工具生成回覆
 */
async function generateCLIReply(request: AIReplyRequest, cliSettings: CLISettings): Promise<AIReplyResponse> {
    const tool = cliSettings.cliTool;

    // 檢查工具是否可用
    const available = await isToolAvailable(tool);
    if (!available) {
        logger.warn(`[AI Service] CLI tool not available: ${tool}`);

        if (cliSettings.cliFallbackToApi) {
            logger.info('[AI Service] Falling back to API mode');
            return generateAPIReply(request);
        }

        return {
            success: false,
            error: `CLI 工具 ${tool} 未安裝或不可用`
        };
    }

    // 建立或取得終端機記錄
    const terminalId = `${request.projectPath || 'default'}-${tool}`.replace(/[^a-zA-Z0-9-]/g, '_');
    let terminal = getCLITerminalById(terminalId);

    if (!terminal) {
        terminal = createCLITerminal({
            id: terminalId,
            projectName: request.projectName || '未命名專案',
            projectPath: request.projectPath || '',
            tool,
            status: 'running',
            pid: undefined
        });
    } else {
        updateCLITerminal(terminalId, { status: 'running' });
    }

    // 建構提示詞
    const prompt = buildCLIPrompt(request);

    try {
        // 執行 CLI
        const result = await executeCLI({
            tool,
            prompt,
            timeout: cliSettings.cliTimeout,
            workingDirectory: request.projectPath,
            outputFormat: 'text'
        });

        // 記錄執行日誌
        insertCLIExecutionLog({
            terminalId,
            prompt: prompt.substring(0, 1000),
            response: result.success ? result.output.substring(0, 5000) : null,
            executionTime: result.executionTime,
            success: result.success,
            error: result.error
        });

        // 更新終端機狀態
        updateCLITerminal(terminalId, { status: result.success ? 'idle' : 'error' });

        if (result.success) {
            return {
                success: true,
                reply: result.output,
                mode: 'cli',
                cliTool: tool,
                promptSent: prompt
            };
        }

        // CLI 執行失敗，檢查是否需要 fallback
        if (cliSettings.cliFallbackToApi) {
            logger.warn('[AI Service] CLI execution failed, falling back to API');
            return generateAPIReply(request);
        }

        return {
            success: false,
            error: result.error || 'CLI 執行失敗',
            mode: 'cli',
            cliTool: tool,
            promptSent: prompt
        };
    } catch (error) {
        // 記錄錯誤
        insertCLIExecutionLog({
            terminalId,
            prompt: prompt.substring(0, 1000),
            response: null,
            executionTime: 0,
            success: false,
            error: error instanceof Error ? error.message : '未知錯誤'
        });

        updateCLITerminal(terminalId, { status: 'error' });

        if (cliSettings.cliFallbackToApi) {
            logger.warn('[AI Service] CLI error, falling back to API');
            return generateAPIReply(request);
        }

        throw error;
    }
}

/**
 * 建構 CLI 提示詞（包含系統提示詞和 MCP 工具）
 */
function buildCLIPrompt(request: AIReplyRequest): string {
    const settings = getAISettings();
    let prompt = '';

    // 加入系統提示詞
    if (settings?.systemPrompt) {
        prompt += `## 系統指令\n${settings.systemPrompt}\n\n`;
    }

    // 加入 MCP 工具提示詞（如果有且請求要求）
    if (request.includeMCPTools && settings?.mcpToolsPrompt) {
        let mcpPrompt = settings.mcpToolsPrompt
            .replace(/\{project_name\}/g, request.projectName || '未命名專案')
            .replace(/\{project_path\}/g, request.projectPath || '');
        
        // 附加工具列表
        try {
            const allTools = mcpClientManager.getAllTools();
            if (allTools.length > 0) {
                mcpPrompt += '\n\n## 可用工具列表\n\n';
                for (const tool of allTools) {
                    mcpPrompt += `### ${tool.name}\n`;
                    if (tool.description) {
                        mcpPrompt += `${tool.description}\n`;
                    }
                    if (tool.inputSchema) {
                        mcpPrompt += '\n參數格式:\n```json\n';
                        mcpPrompt += JSON.stringify(tool.inputSchema, null, 2);
                        mcpPrompt += '\n```\n';
                    }
                    mcpPrompt += '\n';
                }
            }
        } catch {
            // 忽略獲取工具失敗
        }
        
        prompt += `## MCP 工具指令\n${mcpPrompt}\n\n`;
    }

    // 加入使用者上下文
    if (request.userContext) {
        prompt += `## 使用者上下文\n${request.userContext}\n\n`;
    }

    // 加入工具結果（如果有）
    if (request.toolResults) {
        prompt += `## 工具執行結果\n${request.toolResults}\n\n`;
    }

    // 加入主要訊息
    prompt += `## AI 工作匯報\n${request.aiMessage}\n\n`;
    prompt += '請根據以上內容提供簡潔的回覆或建議。';

    return prompt;
}

/**
 * 使用 API 生成回覆（原有邏輯）
 */
async function generateAPIReply(request: AIReplyRequest): Promise<AIReplyResponse> {
    try {
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
                } else {
                    logger.debug('[AI Service] 使用預設的 buildToolsPrompt');
                    // 使用預設的 buildToolsPrompt
                    mcpToolsPrompt = buildToolsPrompt(allTools, request.projectName, request.projectPath);
                }
            } catch (error) {
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

        // 構建提示詞（用於返回給前端顯示）
        const promptSent = buildPrompt(
            settings.systemPrompt,
            request.aiMessage,
            request.userContext,
            mcpToolsPrompt,
            request.toolResults
        );

        const reply = await generateWithRetry(
            settings.apiKey,
            settings.model,
            settings.systemPrompt,
            request.aiMessage,
            request.userContext,
            settings.temperature,
            settings.maxTokens,
            0,
            mcpToolsPrompt,
            request.toolResults
        );
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
            reply,
            promptSent,
            mode: 'api' as const
        };
    } catch (error) {
        logger.error('[AI Service] AI service error:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : '未知錯誤',
            mode: 'api' as const
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
    retryCount: number = 0,
    mcpToolsPrompt: string = '',
    toolResults?: string
): Promise<string> {
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
    } catch (error) {
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
                    return generateWithRetry(
                        apiKey,
                        model,
                        systemPrompt,
                        aiMessage,
                        userContext,
                        temperature,
                        maxTokens,
                        retryCount + 1,
                        mcpToolsPrompt,
                        toolResults
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
                    retryCount + 1,
                    mcpToolsPrompt,
                    toolResults
                );
            }
        }

        throw error;
    }
}

/**
 * 構建提示詞
 */
function buildPrompt(
    systemPrompt: string,
    aiMessage: string,
    userContext?: string,
    mcpToolsPrompt: string = '',
    toolResults?: string
): string {
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

/**
 * 獲取提示詞預覽（供前端顯示）
 */
export async function getPromptPreview(request: AIReplyRequest): Promise<{ success: boolean; prompt: string; mode: 'api' | 'cli'; cliTool?: string; error?: string }> {
    try {
        const cliSettings = getCLISettings();
        
        if (cliSettings?.aiMode === 'cli') {
            // CLI 模式
            const prompt = buildCLIPrompt(request);
            return {
                success: true,
                prompt,
                mode: 'cli',
                cliTool: cliSettings.cliTool
            };
        }
        
        // API 模式
        const settings = getAISettings();
        if (!settings || !settings.apiKey || settings.apiKey === 'YOUR_API_KEY_HERE') {
            return {
                success: false,
                prompt: '',
                mode: 'api',
                error: '請先在設定中配置 AI API Key'
            };
        }
        
        // 構建 MCP 工具提示詞
        let mcpToolsPrompt = '';
        if (request.includeMCPTools) {
            try {
                const allTools = mcpClientManager.getAllTools();
                
                if (settings.mcpToolsPrompt) {
                    mcpToolsPrompt = settings.mcpToolsPrompt
                        .replace(/\{project_name\}/g, request.projectName || '未命名專案')
                        .replace(/\{project_path\}/g, request.projectPath || '');

                    if (allTools.length > 0) {
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
                } else {
                    mcpToolsPrompt = buildToolsPrompt(allTools, request.projectName, request.projectPath);
                }
            } catch {
                // 忽略
            }
        }
        
        const prompt = buildPrompt(
            settings.systemPrompt,
            request.aiMessage,
            request.userContext,
            mcpToolsPrompt,
            request.toolResults
        );
        
        return {
            success: true,
            prompt,
            mode: 'api'
        };
    } catch (error) {
        return {
            success: false,
            prompt: '',
            mode: 'api',
            error: error instanceof Error ? error.message : '獲取提示詞失敗'
        };
    }
}

