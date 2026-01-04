/**
 * CLI Provider
 * 使用 CLI 工具 (gemini/claude) 生成 AI 回覆
 */

import type { IAIProvider, AIProviderMode } from '../types/ai-provider.js';
import type { AIReplyRequest, AIReplyResponse, CLISettings } from '../types/index.js';
import { getAISettings, createCLITerminal, insertCLIExecutionLog, updateCLITerminal, getCLITerminalById, getCLISettings } from './database.js';
import { logger } from './logger.js';
import { executeCLI } from './cli-executor.js';
import { isToolAvailable } from './cli-detector.js';
import { mcpClientManager } from './mcp-client-manager.js';
import { getPromptAggregator, createCLIMCPHandler } from './prompt-aggregator/index.js';

export class CLIProvider implements IAIProvider {
  private cliSettings: CLISettings;

  constructor(cliSettings: CLISettings) {
    this.cliSettings = cliSettings;
  }

  getName(): string {
    return `CLI (${this.cliSettings.cliTool})`;
  }

  getMode(): AIProviderMode {
    return 'cli';
  }

  async isAvailable(): Promise<boolean> {
    return isToolAvailable(this.cliSettings.cliTool);
  }

  async generateReply(request: AIReplyRequest): Promise<AIReplyResponse> {
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
    } else {
      updateCLITerminal(terminalId, { status: 'running' });
    }

    const aggregator = getPromptAggregator();
    const settings = getAISettings();
    const cliSettings = getCLISettings();

    let mcpTools: { name: string; description?: string; inputSchema?: Record<string, unknown> }[] = [];
    if (request.includeMCPTools) {
      try {
        const allTools = mcpClientManager.getAllTools();
        mcpTools = allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as Record<string, unknown>
        }));
      } catch {
        logger.warn('[CLIProvider] 無法獲取 MCP 工具');
      }
    }

    const context = aggregator.buildContextSync(request, settings ?? null, cliSettings, mcpTools);
    context.mode = 'cli';

    const aggregated = aggregator.aggregate(context);
    const prompt = aggregated.fullPrompt;

    // 詳細日誌：Prompt 大小分析
    logger.info(`[CLIProvider] Prompt 大小分析:`, {
      totalLength: prompt.length,
      totalKB: (prompt.length / 1024).toFixed(2) + ' KB',
      mcpToolsCount: mcpTools.length,
      mcpToolsSize: JSON.stringify(mcpTools).length,
      systemPromptLength: settings?.systemPrompt?.length || 0,
      aiMessageLength: request.aiMessage?.length || 0,
      userContextLength: request.userContext?.length || 0,
      timeout: this.cliSettings.cliTimeout
    });

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

      if (!result.success) {
        updateCLITerminal(terminalId, { status: 'error' });
        return {
          success: false,
          error: result.error || 'CLI 執行失敗',
          mode: 'cli',
          cliTool: tool,
          promptSent: prompt
        };
      }

      if (request.includeMCPTools) {
        const mcpHandler = createCLIMCPHandler(settings?.maxToolRounds || 10);
        updateCLITerminal(terminalId, { status: 'mcp-processing' });

        const handlerResult = await mcpHandler.handleResponse(result.output, (call) => {
          logger.info(`[CLIProvider] 執行 MCP 工具: ${call.toolName}`);
        });

        if (handlerResult.toolCallsDetected) {
          insertCLIExecutionLog({
            terminalId,
            prompt: `[MCP] ${handlerResult.toolResults.length} 個工具呼叫`,
            response: handlerResult.finalResponse.substring(0, 5000),
            executionTime: handlerResult.toolResults.reduce((sum: number, r: { executionTime: number }) => sum + r.executionTime, 0),
            success: true,
            error: undefined
          });
        }

        updateCLITerminal(terminalId, { status: 'idle' });

        return {
          success: true,
          reply: handlerResult.finalResponse,
          mode: 'cli',
          cliTool: tool,
          promptSent: prompt
        };
      }

      updateCLITerminal(terminalId, { status: 'idle' });

      return {
        success: true,
        reply: result.output,
        mode: 'cli',
        cliTool: tool,
        promptSent: prompt
      };
    } catch (error) {
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
}
