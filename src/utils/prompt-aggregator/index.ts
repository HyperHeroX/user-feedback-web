/**
 * Prompt Aggregator 模組匯出
 */

// 核心類別
export { PromptAggregator, getPromptAggregator } from './prompt-aggregator.js';

// 組件
export {
    BasePromptComponent,
    SystemPromptComponent,
    MCPToolsPromptComponent,
    UserContextComponent,
    ToolResultsComponent,
    AIMessageComponent,
    ClosingPromptComponent
} from './components/index.js';

// Handlers
export { CLIMCPResponseHandler, createCLIMCPHandler } from './handlers/index.js';

// 類型從 ai-provider.ts 重新導出
export type {
    IPromptComponent,
    PromptContext,
    AggregatedPrompt,
    PromptSection,
    PromptMetadata,
    PromptPreviewResult,
    McpTool,
    MCPToolCall,
    MCPToolResult,
    CLIHandlerResult
} from '../../types/ai-provider.js';
