/**
 * AI Provider 介面定義
 * 工廠模式支援 API 和 CLI 兩種 AI 回覆方式
 */

import type { AIReplyRequest, AIReplyResponse } from './index.js';

/**
 * AI Provider 模式
 */
export type AIProviderMode = 'api' | 'cli';

/**
 * AI Provider 介面
 */
export interface IAIProvider {
  /**
   * 取得 Provider 名稱
   */
  getName(): string;

  /**
   * 取得 Provider 模式
   */
  getMode(): AIProviderMode;

  /**
   * 生成 AI 回覆
   */
  generateReply(request: AIReplyRequest): Promise<AIReplyResponse>;

  /**
   * 檢查 Provider 是否可用
   */
  isAvailable(): Promise<boolean>;
}

/**
 * AI Provider 配置
 */
export interface AIProviderConfig {
  mode: AIProviderMode;
  cliTool?: string;
  fallbackToApi?: boolean;
}
