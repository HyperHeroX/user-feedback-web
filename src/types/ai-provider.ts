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

// ============================================
// Prompt Aggregator Types
// ============================================

/**
 * 提示詞組件介面
 */
export interface IPromptComponent {
  getName(): string;
  getOrder(): number;
  build(context: PromptContext): string | null;
}

/**
 * 提示詞上下文
 */
export interface PromptContext {
  request: import('./index.js').AIReplyRequest;
  settings: import('./index.js').AISettings | null;
  cliSettings?: import('./index.js').CLISettings | null;
  mode: AIProviderMode;
  mcpTools?: McpTool[];
}

/**
 * MCP 工具定義（精簡版）
 */
export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * 提示詞區段
 */
export interface PromptSection {
  name: string;
  content: string;
  order: number;
}

/**
 * 提示詞元數據
 */
export interface PromptMetadata {
  mode: AIProviderMode;
  cliTool?: string;
  tokenEstimate: number;
  componentCount: number;
  timestamp: string;
  /** 完整 prompt 的字元長度 */
  totalLength?: number;
  /** MCP 工具定義的 JSON 大小（字元數） */
  mcpToolsSize?: number;
  /** MCP 工具數量 */
  mcpToolsCount?: number;
}

/**
 * 聚合後的提示詞
 */
export interface AggregatedPrompt {
  fullPrompt: string;
  sections: PromptSection[];
  metadata: PromptMetadata;
}

/**
 * 提示詞預覽結果
 */
export interface PromptPreviewResult {
  success: boolean;
  prompt: string;
  mode: AIProviderMode;
  cliTool?: string;
  error?: string;
  sections?: PromptSection[];
  metadata?: PromptMetadata;
}

// ============================================
// CLI MCP Handler Types
// ============================================

/**
 * MCP 工具呼叫
 */
export interface MCPToolCall {
  toolName: string;
  serverName: string;
  arguments: Record<string, unknown>;
  rawMatch: string;
}

/**
 * MCP 工具結果
 */
export interface MCPToolResult {
  toolName: string;
  serverName: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTime: number;
}

/**
 * CLI 處理結果
 */
export interface CLIHandlerResult {
  finalResponse: string;
  toolCallsDetected: boolean;
  toolResults: MCPToolResult[];
  iterations: number;
  maxIterationsReached: boolean;
}
