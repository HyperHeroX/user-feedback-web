import { parseToolCalls, formatToolResults } from '../../mcp-tool-parser.js';
import { mcpClientManager } from '../../mcp-client-manager.js';
import { logger } from '../../logger.js';
const DEFAULT_MAX_ITERATIONS = 10;
export class CLIMCPResponseHandler {
    maxIterations;
    constructor(maxIterations = DEFAULT_MAX_ITERATIONS) {
        this.maxIterations = maxIterations;
    }
    parseToolCallsFromResponse(aiResponse) {
        const parsed = parseToolCalls(aiResponse);
        if (!parsed.hasToolCalls || !parsed.toolCalls.length) {
            return [];
        }
        return parsed.toolCalls.map(call => ({
            toolName: call.name,
            serverName: this.extractServerName(call.name),
            arguments: call.arguments,
            rawMatch: JSON.stringify(call)
        }));
    }
    extractServerName(toolName) {
        const parts = toolName.split('__');
        return parts.length > 1 ? (parts[0] || 'default') : 'default';
    }
    async executeTools(calls) {
        const results = [];
        for (const call of calls) {
            const startTime = Date.now();
            try {
                const serverId = await this.findServerIdByToolName(call.toolName);
                if (serverId === null) {
                    results.push({
                        toolName: call.toolName,
                        serverName: call.serverName,
                        success: false,
                        error: `無法找到工具 ${call.toolName} 所屬的 MCP Server`,
                        executionTime: Date.now() - startTime
                    });
                    continue;
                }
                const result = await mcpClientManager.callTool(serverId, call.toolName, call.arguments, true);
                const output = result.content
                    ?.map(c => c.type === 'text' ? c.text : `[${c.type}]`)
                    .join('\n');
                const toolResult = {
                    toolName: call.toolName,
                    serverName: call.serverName,
                    success: result.success,
                    output: output || '',
                    executionTime: Date.now() - startTime
                };
                if (result.error) {
                    toolResult.error = result.error;
                }
                results.push(toolResult);
            }
            catch (error) {
                results.push({
                    toolName: call.toolName,
                    serverName: call.serverName,
                    success: false,
                    error: error instanceof Error ? error.message : '執行失敗',
                    executionTime: Date.now() - startTime
                });
            }
        }
        return results;
    }
    async findServerIdByToolName(toolName) {
        const allTools = mcpClientManager.getAllTools();
        const tool = allTools.find(t => t.name === toolName);
        if (tool && typeof tool.serverId === 'number') {
            return tool.serverId;
        }
        // 嘗試從工具名稱中提取服務器名稱並查找
        const serverName = this.extractServerName(toolName);
        const toolWithServer = allTools.find(t => {
            const toolServerName = this.extractServerName(t.name);
            return toolServerName === serverName;
        });
        if (toolWithServer && typeof toolWithServer.serverId === 'number') {
            return toolWithServer.serverId;
        }
        return null;
    }
    formatResultsPrompt(results) {
        if (results.length === 0) {
            return '';
        }
        const executionResults = results.map(r => {
            const result = {
                name: r.toolName,
                success: r.success
            };
            if (r.output)
                result.result = r.output;
            if (r.error)
                result.error = r.error;
            return result;
        });
        return formatToolResults(executionResults);
    }
    async handleResponse(aiResponse, onToolExecution) {
        let currentResponse = aiResponse;
        let iterations = 0;
        const allToolResults = [];
        while (iterations < this.maxIterations) {
            const toolCalls = this.parseToolCallsFromResponse(currentResponse);
            if (toolCalls.length === 0) {
                break;
            }
            logger.info(`[CLIMCPHandler] 偵測到 ${toolCalls.length} 個工具呼叫 (迭代 ${iterations + 1})`);
            for (const call of toolCalls) {
                if (onToolExecution) {
                    onToolExecution(call);
                }
            }
            const results = await this.executeTools(toolCalls);
            allToolResults.push(...results);
            currentResponse = this.formatResultsPrompt(results);
            iterations++;
            if (results.every(r => !r.success)) {
                logger.warn('[CLIMCPHandler] 所有工具執行失敗，停止迭代');
                break;
            }
        }
        const maxIterationsReached = iterations >= this.maxIterations;
        if (maxIterationsReached) {
            logger.warn(`[CLIMCPHandler] 達到最大迭代次數 (${this.maxIterations})`);
        }
        return {
            finalResponse: currentResponse || aiResponse,
            toolCallsDetected: allToolResults.length > 0,
            toolResults: allToolResults,
            iterations,
            maxIterationsReached
        };
    }
    setMaxIterations(max) {
        this.maxIterations = max;
    }
    getMaxIterations() {
        return this.maxIterations;
    }
}
export function createCLIMCPHandler(maxIterations) {
    return new CLIMCPResponseHandler(maxIterations);
}
//# sourceMappingURL=cli-mcp-handler.js.map