/**
 * CLI MCP 回應處理器
 * 負責解析 AI 回應中的 MCP 工具呼叫並執行
 */
import type { MCPToolCall, MCPToolResult, CLIHandlerResult } from '../../../types/ai-provider.js';
export declare class CLIMCPResponseHandler {
    private maxIterations;
    constructor(maxIterations?: number);
    parseToolCallsFromResponse(aiResponse: string): MCPToolCall[];
    private extractServerName;
    executeTools(calls: MCPToolCall[]): Promise<MCPToolResult[]>;
    private findServerIdByToolName;
    formatResultsPrompt(results: MCPToolResult[]): string;
    handleResponse(aiResponse: string, onToolExecution?: (call: MCPToolCall) => void): Promise<CLIHandlerResult>;
    setMaxIterations(max: number): void;
    getMaxIterations(): number;
}
export declare function createCLIMCPHandler(maxIterations?: number): CLIMCPResponseHandler;
//# sourceMappingURL=cli-mcp-handler.d.ts.map