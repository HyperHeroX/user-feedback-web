/**
 * OpenAI-Compatible Provider
 * 支援 OpenAI API 相容的服務（NVIDIA, Z.AI 等）
 */

import type { IAIProvider, AIProviderMode } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse } from '../types/index.js';
import { logger } from './logger.js';
import { getPromptAggregator } from './prompt-aggregator/index.js';
import { mcpClientManager } from './mcp-client-manager.js';
import { getAISettings, getCLISettings } from './database.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
}

interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAICompatibleProvider implements IAIProvider {
  private config: OpenAICompatibleConfig;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
  }

  getName(): string {
    return this.config.name;
  }

  getMode(): AIProviderMode {
    return 'api';
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.config.apiKey && this.config.baseUrl && this.config.model);
  }

  async generateReply(request: AIReplyRequest): Promise<AIReplyResponse> {
    try {
      const settings = getAISettings();
      if (!this.config.apiKey) {
        logger.warn(`[${this.config.name}] API Key 未設定`);
        return { success: false, error: `請先配置 ${this.config.name} API Key`, mode: 'api' };
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
          logger.warn(`[${this.config.name}] 無法取得 MCP 工具`, error);
        }
      }

      const isFirstCall = request.isFirstCall !== false;
      const context = aggregator.buildContextSync(request, settings, cliSettings, mcpTools, isFirstCall);
      context.mode = 'api';

      const aggregated = aggregator.aggregate(context);
      const promptSent = aggregated.fullPrompt;

      const reply = await this.generateWithRetry(promptSent);

      return { success: true, reply, promptSent, mode: 'api' };
    } catch (error) {
      logger.error(`[${this.config.name}] 生成回覆失敗`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤',
        mode: 'api'
      };
    }
  }

  private async generateWithRetry(prompt: string, retryCount = 0): Promise<string> {
    try {
      const messages: ChatCompletionMessage[] = [
        { role: 'user', content: prompt }
      ];

      const response = await this.callChatCompletions(messages);
      const text = response.choices[0]?.message?.content;

      if (!text) throw new Error('AI 回覆為空');
      return text;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('rate') || error.message.includes('quota')) {
          if (retryCount < MAX_RETRIES) {
            await this.sleep(RETRY_DELAYS[retryCount] || 4000);
            return this.generateWithRetry(prompt, retryCount + 1);
          }
          throw new Error('API 配額已用盡或速率限制，請稍後再試');
        }

        if (error.message.includes('401') || error.message.includes('unauthorized') || error.message.includes('API key')) {
          throw new Error(`${this.config.name} API Key 無效，請檢查設定`);
        }

        if (retryCount < MAX_RETRIES) {
          await this.sleep(RETRY_DELAYS[retryCount] || 4000);
          return this.generateWithRetry(prompt, retryCount + 1);
        }
      }
      throw error;
    }
  }

  private async callChatCompletions(messages: ChatCompletionMessage[]): Promise<ChatCompletionResponse> {
    const endpoint = this.config.baseUrl.endsWith('/chat/completions')
      ? this.config.baseUrl
      : `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers
    };

    const body = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature ?? 0.7,
      max_tokens: this.config.maxTokens ?? 1000
    };

    logger.debug(`[${this.config.name}] 呼叫 API: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 錯誤 (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<ChatCompletionResponse>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * NVIDIA Provider
 */
export class NVIDIAProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, model: string) {
    super({
      name: 'NVIDIA',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey,
      model
    });
  }
}

/**
 * Z.AI (Zhipu AI) Provider
 */
export class ZAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, model: string, region: 'international' | 'china' = 'international') {
    const baseUrl = region === 'china'
      ? 'https://open.bigmodel.cn/api/paas/v4'
      : 'https://api.z.ai/api/paas/v4';

    super({
      name: 'Z.AI (Zhipu AI)',
      baseUrl,
      apiKey,
      model,
      headers: {
        'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
      }
    });
  }
}
