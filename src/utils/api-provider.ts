/**
 * API Provider
 * 支援 Google Gemini API 和 OpenAI 相容 API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { IAIProvider, AIProviderMode } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse } from '../types/index.js';
import { getAISettings, getCLISettings } from './database.js';
import { logger } from './logger.js';
import { mcpClientManager } from './mcp-client-manager.js';
import { getPromptAggregator } from './prompt-aggregator/index.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];


function getProviderFromUrl(apiUrl?: string): string {
  if (!apiUrl) return 'google';
  const normalizedUrl = apiUrl.toLowerCase();
  if (normalizedUrl.includes('api.openai.com')) return 'openai';
  if (normalizedUrl.includes('api.anthropic.com')) return 'anthropic';
  if (normalizedUrl.includes('generativelanguage.googleapis.com')) return 'google';
  if (normalizedUrl.includes('nvidia.com')) return 'nvidia';
  if (normalizedUrl.includes('bigmodel.cn') || normalizedUrl.includes('z.ai')) return 'zai';
  return 'openai';
}

export class APIProvider implements IAIProvider {
  getName(): string {
    return 'API Provider';
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
      const settings = getAISettings();
      logger.info('[APIProvider] AI 設定狀態', {
        hasSettings: !!settings,
        hasApiKey: !!settings?.apiKey,
        apiKeyLength: settings?.apiKey?.length,
        apiKeyPrefix: settings?.apiKey?.substring(0, 6),
        model: settings?.model,
        apiUrl: settings?.apiUrl || '(未設定)',
        temperature: settings?.temperature,
        maxTokens: settings?.maxTokens
      });

      if (!settings || !settings.apiKey || settings.apiKey === 'YOUR_API_KEY_HERE') {
        logger.warn('[APIProvider] API Key 未設定或無效');
        return { success: false, error: '請先在設定中配置 AI API Key', mode: 'api' };
      }

      const aggregator = getPromptAggregator();
      const cliSettings = getCLISettings();

      let mcpTools: { name: string; description?: string; inputSchema?: Record<string, unknown> }[] = [];
      if (request.includeMCPTools) {
        try {
          const allTools = mcpClientManager.getAllTools();
          mcpTools = allTools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema as Record<string, unknown>
          }));
        } catch (error) {
          logger.warn('[APIProvider] 無法取得 MCP 工具', error);
        }
      }

      const context = aggregator.buildContextSync(request, settings, cliSettings, mcpTools);
      context.mode = 'api';

      const aggregated = aggregator.aggregate(context);
      const promptSent = aggregated.fullPrompt;
      logger.info(`[APIProvider] Prompt 已建構, 長度: ${promptSent.length}`);

      const provider = getProviderFromUrl(settings.apiUrl);
      logger.info(`[APIProvider] 使用 ${provider} 提供商, apiUrl: ${settings.apiUrl || '(預設)'}, model: ${settings.model}`);

      const startTime = Date.now();
      let reply: string;
      if (provider !== 'google') {
        logger.info(`[APIProvider] 開始呼叫 OpenAI 相容 API...`);
        reply = await this.generateWithOpenAI(
          settings.apiKey,
          settings.model,
          settings.apiUrl,
          promptSent,
          settings.temperature,
          settings.maxTokens
        );
      } else {
        logger.info(`[APIProvider] 開始呼叫 Google Gemini API...`);
        reply = await this.generateWithGoogle(
          settings.apiKey,
          settings.model,
          promptSent,
          settings.temperature,
          settings.maxTokens
        );
      }
      logger.info(`[APIProvider] API 呼叫完成, 耗時: ${Date.now() - startTime}ms, 回覆長度: ${reply.length}`);

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

  private async generateWithGoogle(
    apiKey: string,
    model: string,
    prompt: string,
    temperature?: number,
    maxTokens?: number,
    retryCount = 0
  ): Promise<string> {
    try {
      logger.info(`[APIProvider/Google] 呼叫 API: model=${model}, promptLength=${prompt.length}, retry=${retryCount}`);
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
            return this.generateWithGoogle(apiKey, model, prompt, temperature, maxTokens, retryCount + 1);
          }
          throw new Error('API 配額已用盡或速率限制，請稍後再試');
        }

        if (error.message.includes('API key') || error.message.includes('401')) {
          throw new Error('API Key 無效，請檢查設定');
        }

        if (retryCount < MAX_RETRIES) {
          await this.sleep(RETRY_DELAYS[retryCount] || 4000);
          return this.generateWithGoogle(apiKey, model, prompt, temperature, maxTokens, retryCount + 1);
        }
      }
      throw error;
    }
  }

  private async generateWithOpenAI(
    apiKey: string,
    model: string,
    apiUrl: string | undefined,
    prompt: string,
    temperature?: number,
    maxTokens?: number,
    retryCount = 0
  ): Promise<string> {
    try {
      const baseURL = apiUrl || 'https://api.openai.com/v1';
      logger.info(`[APIProvider/OpenAI] 呼叫 API: baseURL=${baseURL}, model=${model}, promptLength=${prompt.length}, retry=${retryCount}`);

      const OpenAI = (await import('openai')).default;
      const client = new OpenAI({
        apiKey,
        baseURL,
        timeout: 120000,
      });

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: temperature ?? 0.7,
        max_tokens: maxTokens ?? 1000,
      });

      logger.info(`[APIProvider/OpenAI] API 回應: choices=${response.choices?.length}, usage=${JSON.stringify(response.usage)}`);

      const text = response.choices?.[0]?.message?.content;
      if (!text) throw new Error('AI 回覆為空');
      return text;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate')) {
          if (retryCount < MAX_RETRIES) {
            await this.sleep(RETRY_DELAYS[retryCount] || 4000);
            return this.generateWithOpenAI(apiKey, model, apiUrl, prompt, temperature, maxTokens, retryCount + 1);
          }
          throw new Error('API 配額已用盡或速率限制，請稍後再試');
        }

        if (error.message.includes('API key') || error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new Error('API Key 無效，請檢查設定');
        }

        if (retryCount < MAX_RETRIES) {
          await this.sleep(RETRY_DELAYS[retryCount] || 4000);
          return this.generateWithOpenAI(apiKey, model, apiUrl, prompt, temperature, maxTokens, retryCount + 1);
        }
      }
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}
