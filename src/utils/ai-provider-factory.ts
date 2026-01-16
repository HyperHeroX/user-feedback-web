/**
 * AI Provider Factory
 * 工廠模式實作 - 根據設定創建 API 或 CLI Provider
 */

import type { IAIProvider, AIProviderConfig, AIProviderMode, APIProviderType } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse, CLISettings } from '../types/index.js';
import { getCLISettings, getAISettings } from './database.js';
import { logger } from './logger.js';
import { APIProvider } from './api-provider.js';
import { CLIProvider } from './cli-provider.js';
import { NVIDIAProvider, ZAIProvider, OpenAICompatibleProvider } from './openai-compatible-provider.js';

/**
 * AI Provider 工廠類別
 */
export class AIProviderFactory {
  private static instance: AIProviderFactory;
  private currentProvider: IAIProvider | null = null;
  private fallbackProvider: IAIProvider | null = null;

  private constructor() {}

  /**
   * 取得工廠實例 (Singleton)
   */
  static getInstance(): AIProviderFactory {
    if (!AIProviderFactory.instance) {
      AIProviderFactory.instance = new AIProviderFactory();
    }
    return AIProviderFactory.instance;
  }

  /**
   * 根據設定取得適當的 Provider
   */
  async getProvider(): Promise<IAIProvider> {
    const cliSettings = getCLISettings();
    const mode: AIProviderMode = cliSettings?.aiMode === 'cli' ? 'cli' : 'api';

    logger.debug('[AIProviderFactory] 取得 Provider', { mode, cliTool: cliSettings?.cliTool });

    if (mode === 'cli') {
      const cliProvider = new CLIProvider(cliSettings as CLISettings);
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
  getCurrentMode(): AIProviderMode {
    const cliSettings = getCLISettings();
    return cliSettings?.aiMode === 'cli' ? 'cli' : 'api';
  }

  /**
   * 取得當前 CLI 工具名稱
   */
  getCurrentCLITool(): string | undefined {
    const cliSettings = getCLISettings();
    return cliSettings?.cliTool;
  }

  /**
   * 使用工廠生成 AI 回覆
   */
  async generateReply(request: AIReplyRequest): Promise<AIReplyResponse> {
    try {
      const provider = await this.getProvider();
      logger.info(`[AIProviderFactory] 使用 ${provider.getName()} 生成回覆`);
      return provider.generateReply(request);
    } catch (error) {
      logger.error('[AIProviderFactory] 生成回覆失敗', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知錯誤'
      };
    }
  }

  /**
   * 創建特定類型的 API Provider
   */
  createAPIProvider(
    providerType: APIProviderType,
    config: {
      apiKey: string;
      model: string;
      baseUrl?: string;
      region?: 'international' | 'china';
    }
  ): IAIProvider {
    switch (providerType) {
      case 'nvidia':
        return new NVIDIAProvider(config.apiKey, config.model);
      
      case 'zai':
        return new ZAIProvider(config.apiKey, config.model, config.region || 'international');
      
      case 'openai':
        return new OpenAICompatibleProvider({
          name: 'OpenAI',
          baseUrl: config.baseUrl || 'https://api.openai.com/v1',
          apiKey: config.apiKey,
          model: config.model
        });
      
      case 'anthropic':
        return new OpenAICompatibleProvider({
          name: 'Anthropic',
          baseUrl: config.baseUrl || 'https://api.anthropic.com/v1',
          apiKey: config.apiKey,
          model: config.model,
          headers: {
            'anthropic-version': '2023-06-01'
          }
        });
      
      case 'google':
      default:
        return new APIProvider();
    }
  }

  /**
   * 獲取支援的 API Provider 類型列表
   */
  getSupportedProviderTypes(): APIProviderType[] {
    return ['openai', 'anthropic', 'google', 'nvidia', 'zai'];
  }
}

/**
 * 取得 AI Provider 工廠實例
 */
export function getAIProviderFactory(): AIProviderFactory {
  return AIProviderFactory.getInstance();
}
