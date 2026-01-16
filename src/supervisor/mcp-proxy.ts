/**
 * MCP Proxy Handler for Supervisor
 * Handles MCP requests and routes them to worker or handles locally
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SupervisorService } from './supervisor-service.js';
import type { SelfTestResult } from '../shared/ipc-types.js';

export class MCPProxyHandler {
  private supervisor: SupervisorService;
  private mcpServer: Server;
  private workerTools: Map<string, { description: string; inputSchema: Record<string, unknown> }> = new Map();

  constructor(supervisor: SupervisorService, mcpServer: Server) {
    this.supervisor = supervisor;
    this.mcpServer = mcpServer;
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle ListTools - combine supervisor tools with worker tools
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        // Supervisor-level tool
        {
          name: 'self_test',
          description: '執行系統自我診斷與修復。檢查 Supervisor、Worker、Web Server、資料庫狀態。若 Worker 失效會自動重啟。返回完整健康狀態與診斷資訊。',
          inputSchema: {
            type: 'object' as const,
            properties: {},
            required: [],
          },
        },
      ];

      // Add worker tools if available
      for (const [name, tool] of this.workerTools) {
        tools.push({
          name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }

      return { tools };
    });

    // Handle CallTool - route to appropriate handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Check if it's a supervisor tool
      if (name === 'self_test') {
        return this.handleSelfTest();
      }

      // Otherwise, proxy to worker
      return this.proxyToWorker(name, args);
    });
  }

  /**
   * Register tools from worker
   */
  registerWorkerTools(tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>): void {
    this.workerTools.clear();
    for (const tool of tools) {
      this.workerTools.set(tool.name, {
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }
  }

  /**
   * Handle self_test tool call
   */
  private async handleSelfTest(): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const result: SelfTestResult = await this.supervisor.selfTest();

      const text = this.formatSelfTestResult(result);

      return {
        content: [{ type: 'text', text }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ 自我診斷執行失敗: ${errorMessage}`,
          },
        ],
      };
    }
  }

  /**
   * Format self-test result for display
   */
  private formatSelfTestResult(result: SelfTestResult): string {
    const lines: string[] = [];
    const emoji = result.success ? '✅' : '⚠️';

    lines.push(`${emoji} **自我診斷結果**`);
    lines.push(`時間: ${result.timestamp}`);
    lines.push('');

    // Health Status
    lines.push('## 健康狀態');
    lines.push(`- Supervisor: ${this.statusEmoji(result.health.supervisor.status)} ${result.health.supervisor.status}`);
    lines.push(`  - PID: ${result.health.supervisor.pid}`);
    lines.push(`  - 運行時間: ${this.formatUptime(result.health.supervisor.uptime)}`);
    lines.push(`  - 記憶體: ${this.formatMemory(result.health.supervisor.memoryUsage.heapUsed)}`);
    lines.push('');
    lines.push(`- Worker: ${this.statusEmoji(result.health.worker.status)} ${result.health.worker.status}`);
    lines.push(`  - PID: ${result.health.worker.pid ?? 'N/A'}`);
    lines.push(`  - 運行時間: ${result.health.worker.uptime ? this.formatUptime(result.health.worker.uptime) : 'N/A'}`);
    lines.push(`  - 重啟次數: ${result.health.worker.restartCount}`);
    lines.push('');
    lines.push(`- Web Server: ${this.statusEmoji(result.health.webServer.status)} ${result.health.webServer.status}`);
    lines.push(`  - 連接埠: ${result.health.webServer.port ?? 'N/A'}`);
    lines.push(`  - 活動連線: ${result.health.webServer.activeConnections}`);
    lines.push('');
    lines.push(`- 資料庫: ${this.statusEmoji(result.health.database.status)} ${result.health.database.status}`);
    lines.push('');

    // Auto Repair
    if (result.autoRepair) {
      lines.push('## 自動修復');
      lines.push(`- 操作: ${result.autoRepair.action}`);
      lines.push(`- 原因: ${result.autoRepair.reason}`);
      lines.push(`- 原 PID: ${result.autoRepair.previousPid ?? 'N/A'}`);
      lines.push(`- 新 PID: ${result.autoRepair.newPid}`);
      lines.push('');
    }

    // Diagnostics
    lines.push('## 系統資訊');
    lines.push(`- 平台: ${result.diagnostics.system.platform}`);
    lines.push(`- Node.js: ${result.diagnostics.system.nodeVersion}`);
    lines.push(`- 總記憶體: ${this.formatMemory(result.diagnostics.system.totalMemory)}`);
    lines.push(`- 可用記憶體: ${this.formatMemory(result.diagnostics.system.freeMemory)}`);
    lines.push('');

    // Restart History
    if (result.diagnostics.restartHistory.length > 0) {
      lines.push('## 重啟歷史');
      for (const entry of result.diagnostics.restartHistory.slice(-5)) {
        lines.push(`- ${entry.timestamp}: ${entry.reason}`);
      }
      lines.push('');
    }

    // Summary
    lines.push('---');
    lines.push(`**總結**: ${result.summary}`);

    return lines.join('\n');
  }

  private statusEmoji(status: string): string {
    switch (status) {
      case 'ok':
        return '🟢';
      case 'restarted':
        return '🟡';
      case 'error':
      case 'failed':
        return '🔴';
      case 'not_running':
        return '⚪';
      default:
        return '⚫';
    }
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  private formatMemory(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  }

  /**
   * Proxy tool call to worker
   */
  private async proxyToWorker(
    toolName: string,
    args: Record<string, unknown> | undefined
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      const result = await this.supervisor.sendMCPToolRequest(toolName, args);
      
      // Assume result has content array
      if (result && typeof result === 'object' && 'content' in result) {
        return result as { content: Array<{ type: 'text'; text: string }> };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ 工具執行失敗: ${errorMessage}\n\n提示: 可以使用 \`self_test\` 工具檢查系統狀態並嘗試自動修復。`,
          },
        ],
      };
    }
  }
}
