/**
 * MCP Tool Call Parser
 * 解析 AI 回覆中的 tool_calls JSON 格式
 */
export interface ToolCall {
    name: string;
    arguments: Record<string, unknown>;
}
export interface ToolCallResult {
    hasToolCalls: boolean;
    toolCalls: ToolCall[];
    message: string | null;
}
export interface ToolExecutionResult {
    name: string;
    success: boolean;
    result?: unknown;
    error?: string;
}
/**
 * 解析 AI 回覆中的工具呼叫
 * @param aiResponse AI 的原始回覆文字
 * @returns ToolCallResult 解析結果
 */
export declare function parseToolCalls(aiResponse: string): ToolCallResult;
/**
 * 格式化工具執行結果為 AI 可讀的訊息
 * @param results 工具執行結果陣列
 * @returns 格式化的訊息字串
 */
export declare function formatToolResults(results: ToolExecutionResult[]): string;
/**
 * 建構包含工具描述的 system prompt 片段
 * @param tools 可用的 MCP 工具列表
 * @param projectName 專案名稱（可選）
 * @param projectPath 專案路徑（可選）
 * @returns system prompt 片段
 */
export declare function buildToolsPrompt(tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
}>, projectName?: string, projectPath?: string): string;
//# sourceMappingURL=mcp-tool-parser.d.ts.map