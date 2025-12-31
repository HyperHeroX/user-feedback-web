/**
 * API Provider
 * 使用 Google Gemini API 生成 AI 回覆
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { IAIProvider, AIProviderMode } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse } from '../types/index.js';
import { getAISettings } from './database.js';
import { logger } from './logger.js';
import { buildToolsPrompt } from './mcp-tool-parser.js';
import { mcpClientManager } from './mcp-client-manager.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

interface CacheEntry {
  reply: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

export class APIProvider implements IAIProvider {
  getName(): string {
    return 'Google Gemini API';
  }

  getMode(): AIProviderMode {
    return 'api';
  }

  async isAvailable(): Promise<boolean> {
    const settings = getAISettings();
    return !!(settings?.apiKey && settings.apiKey !== 'YOUR_API_KEY_HERE');
  }

  async generateReply(request: AIReplyRequest): Promise<AIReplyResponse> {
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
                if (tool.description) mcpToolsPrompt += `${tool.description}\n`;
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
        } catch (error) {
          logger.warn('[APIProvider] 無法取得 MCP 工具', error);
        }
      }

      const promptSent = this.buildPrompt(
        settings.systemPrompt,
        request.aiMessage,
        request.userContext,
        mcpToolsPrompt,
        request.toolResults
      );

      const reply = await this.generateWithRetry(
        settings.apiKey,
        settings.model,
        promptSent,
        settings.temperature,
        settings.maxTokens
      );

      if (!request.toolResults) {
        cache.set(cacheKey, { reply, timestamp: Date.now() });
        this.cleanExpiredCache();
      }

      return { success: true, reply, promptSent, mode: 'api' };
    } catch (error) {
      logger.error('[APIProvider] 生成回覆失敗', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
        mode: 'api'
      };
    }
  }

  private buildPrompt(
    systemPrompt: string,
    aiMessage: string,
    userContext?: string,
    mcpToolsPrompt = '',
    toolResults?: string
  ): string {
    let prompt = `${systemPrompt}\n\n`;
    if (mcpToolsPrompt) prompt += mcpToolsPrompt + '\n\n';
    prompt += `AI 工作匯報：\n${aiMessage}\n\n`;
    if (userContext) prompt += `使用者上下文：\n${userContext}\n\n`;
    if (toolResults) prompt += `先前工具執行結果：\n${toolResults}\n\n`;
    prompt += '請生成一個簡潔、專業的回應：';
    return prompt;
  }

  private async generateWithRetry(
    apiKey: string,
    model: string,
    prompt: string,
    temperature?: number,
    maxTokens?: number,
    retryCount = 0
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

      const result = await generativeModel.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) throw new Error('AI 回覆為空');
      return text;
    } catch (error) {
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) cache.delete(key);
    }
  }
}
