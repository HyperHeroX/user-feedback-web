/**
 * CLI Provider
 * 使用 CLI 工具 (gemini/claude) 生成 AI 回覆
 */
import { getAISettings, createCLITerminal, insertCLIExecutionLog, updateCLITerminal, getCLITerminalById } from './database.js';
import { logger } from './logger.js';
import { executeCLI } from './cli-executor.js';
import { isToolAvailable } from './cli-detector.js';
import { mcpClientManager } from './mcp-client-manager.js';
export class CLIProvider {
    cliSettings;
    constructor(cliSettings) {
        this.cliSettings = cliSettings;
    }
    getName() {
        return `CLI (${this.cliSettings.cliTool})`;
    }
    getMode() {
        return 'cli';
    }
    async isAvailable() {
        return isToolAvailable(this.cliSettings.cliTool);
    }
    async generateReply(request) {
        const tool = this.cliSettings.cliTool;
        const available = await this.isAvailable();
        if (!available) {
            logger.warn(`[CLIProvider] CLI tool not available: ${tool}`);
            return {
                success: false,
                error: `CLI 工具 ${tool} 未安裝或不可用`,
                mode: 'cli',
                cliTool: tool
            };
        }
        const terminalId = `${request.projectPath || 'default'}-${tool}`.replace(/[^a-zA-Z0-9-]/g, '_');
        let terminal = getCLITerminalById(terminalId);
        if (!terminal) {
            terminal = createCLITerminal({
                id: terminalId,
                projectName: request.projectName || '未命名專案',
                projectPath: request.projectPath || '',
                tool,
                status: 'running',
                pid: undefined
            });
        }
        else {
            updateCLITerminal(terminalId, { status: 'running' });
        }
        const prompt = this.buildCLIPrompt(request);
        try {
            const result = await executeCLI({
                tool,
                prompt,
                timeout: this.cliSettings.cliTimeout,
                workingDirectory: request.projectPath,
                outputFormat: 'text'
            });
            insertCLIExecutionLog({
                terminalId,
                prompt: prompt.substring(0, 1000),
                response: result.success ? result.output.substring(0, 5000) : null,
                executionTime: result.executionTime,
                success: result.success,
                error: result.error
            });
            updateCLITerminal(terminalId, { status: result.success ? 'idle' : 'error' });
            if (result.success) {
                return {
                    success: true,
                    reply: result.output,
                    mode: 'cli',
                    cliTool: tool,
                    promptSent: prompt
                };
            }
            return {
                success: false,
                error: result.error || 'CLI 執行失敗',
                mode: 'cli',
                cliTool: tool,
                promptSent: prompt
            };
        }
        catch (error) {
            insertCLIExecutionLog({
                terminalId,
                prompt: prompt.substring(0, 1000),
                response: null,
                executionTime: 0,
                success: false,
                error: error instanceof Error ? error.message : '未知錯誤'
            });
            updateCLITerminal(terminalId, { status: 'error' });
            return {
                success: false,
                error: error instanceof Error ? error.message : '未知錯誤',
                mode: 'cli',
                cliTool: tool,
                promptSent: prompt
            };
        }
    }
    buildCLIPrompt(request) {
        const settings = getAISettings();
        let prompt = '';
        if (settings?.systemPrompt) {
            prompt += `## 系統指令\n${settings.systemPrompt}\n\n`;
        }
        if (request.includeMCPTools && settings?.mcpToolsPrompt) {
            let mcpPrompt = settings.mcpToolsPrompt
                .replace(/\{project_name\}/g, request.projectName || '未命名專案')
                .replace(/\{project_path\}/g, request.projectPath || '');
            try {
                const allTools = mcpClientManager.getAllTools();
                if (allTools.length > 0) {
                    mcpPrompt += '\n\n## 可用工具列表\n\n';
                    for (const tool of allTools) {
                        mcpPrompt += `### ${tool.name}\n`;
                        if (tool.description)
                            mcpPrompt += `${tool.description}\n`;
                        if (tool.inputSchema) {
                            mcpPrompt += '\n參數格式:\n```json\n';
                            mcpPrompt += JSON.stringify(tool.inputSchema, null, 2);
                            mcpPrompt += '\n```\n';
                        }
                        mcpPrompt += '\n';
                    }
                }
            }
            catch {
                // 忽略獲取工具失敗
            }
            prompt += `## MCP 工具指令\n${mcpPrompt}\n\n`;
        }
        if (request.userContext) {
            prompt += `## 使用者上下文\n${request.userContext}\n\n`;
        }
        if (request.toolResults) {
            prompt += `## 工具執行結果\n${request.toolResults}\n\n`;
        }
        prompt += `## AI 工作匯報\n${request.aiMessage}\n\n`;
        prompt += '請根據以上內容提供簡潔的回覆或建議。';
        return prompt;
    }
}
//# sourceMappingURL=cli-provider.js.map