/**
 * user-feedback MCP Tools - MCP伺服器實作
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolResult, TextContent, ImageContent, SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Config, CollectFeedbackParams, MCPError, FeedbackData, ImageData, MCPLogLevel, MCPLogMessage } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { WebServer } from './web-server.js';
import { getPackageVersion } from '../utils/version.js';

/**
 * MCP伺服器類別
 */
export class MCPServer {
  private mcpServer: McpServer;
  private webServer: WebServer;
  private config: Config;
  private isRunning = false;

  constructor(config: Config) {
    this.config = config;

    // 创建MCP服务器实例
    this.mcpServer = new McpServer({
      name: 'user-web-feedback',
      version: getPackageVersion()
    }, {
      capabilities: {
        tools: {},
        logging: {} // 添加日志功能支持
      }
    });

    // 設定初始化完成回呼
    this.mcpServer.server.oninitialized = () => {
      logger.info('MCP初始化完成');
    };

    // 建立Web伺服器實例
    this.webServer = new WebServer(config);

    // 註冊MCP工具函式和日誌處理
    this.registerTools();
    this.setupLogging();
  }

  /**
   * 註冊MCP工具函式
   */
  private registerTools(): void {
    // 註冊collect_feedback工具 - 使用新的registerTool方法
    this.mcpServer.registerTool(
      'collect_feedback',
      {
        description: 'Collect feedback from users about AI work summary. This tool opens a web interface for users to provide feedback on the AI\'s work.',
        inputSchema: {
          work_summary: z.string().describe('AI工作匯報內容，描述AI完成的工作和結果'),
          project_name: z.string().optional().describe('專案名稱（用於 Dashboard 分組顯示）'),
          project_path: z.string().optional().describe('專案路徑（用於唯一識別專案）')
        }
      },
      // @ts-expect-error - MCP SDK type instantiation depth issue with TS 5.9
      async (args: { work_summary: string; project_name?: string; project_path?: string }) => {
        const params: CollectFeedbackParams = {
          work_summary: args.work_summary,
          project_name: args.project_name,
          project_path: args.project_path
        };

        logger.mcp('collect_feedback', params);

        try {
          // 在呼叫 collectFeedback 之前，發送一個 MCP 日誌/通知說明正在等待使用者回覆
          try {
            await this.mcpServer.server.notification({
              method: 'notifications/message',
              params: {
                level: 'info',
                logger: 'user-web-feedback',
                data: {
                  event: 'collect_feedback_waiting',
                  work_summary_length: params.work_summary.length,
                  project_name: params.project_name
                }
              }
            });
          } catch (nErr) {
            // 靜默失敗，不影響流程
          }

          const result = await this.collectFeedback(params);

          // collectFeedback 現在會回傳 { feedback, sessionId, feedbackUrl }
          // 在等待開始後，通知 caller 反馈页面地址。
          try {
            await this.mcpServer.server.notification({
              method: 'notifications/message',
              params: {
                level: 'info',
                logger: 'user-web-feedback',
                data: {
                  event: 'collect_feedback_created',
                  sessionId: result.sessionId,
                  feedbackUrl: result.feedbackUrl,
                  projectId: result.projectId,
                  projectName: result.projectName
                }
              }
            });
          } catch (nErr) {
            // 忽略通知錯誤
          }

          logger.mcp('collect_feedback', params, { feedback_count: result.feedback.length });

          // 將格式化後的 feedback 傳回作為工具結果
          const content = this.formatFeedbackForMCP(result.feedback);

          return {
            content,
            isError: false
          } as CallToolResult;

        } catch (error) {
          logger.error('collect_feedback工具呼叫失敗:', error);

          if (error instanceof MCPError) {
            throw error;
          }

          throw new MCPError(
            'Failed to collect feedback',
            'COLLECT_FEEDBACK_ERROR',
            error
          );
        }
      }
    );

    if (logger.getLevel() !== 'silent') {
      logger.info('MCP工具函式註冊完成');
    }
  }

  /**
   * 設定MCP日誌功能
   */
  private setupLogging(): void {
    // 設定MCP日誌回呼
    logger.setMCPLogCallback((message: MCPLogMessage) => {
      this.sendLogNotification(message).catch(() => {
        // 靜默處理錯誤，避免未處理的Promise拒絕
      });
    });

    // 處理日誌級別設定請求
    this.mcpServer.server.setRequestHandler(SetLevelRequestSchema, async (request) => {
      const level = request.params.level as MCPLogLevel;
      logger.setMCPLogLevel(level);
      logger.info(`MCP日誌級別已設定為: ${level}`);

      return {}; // 回傳空結果表示成功
    });

    logger.info('MCP日誌功能已設定');
  }

  /**
   * 傳送MCP日誌通知
   */
  private async sendLogNotification(message: MCPLogMessage): Promise<void> {
    try {
      await this.mcpServer.server.notification({
        method: 'notifications/message',
        params: {
          level: message.level,
          logger: message.logger,
          data: message.data
        }
      });
    } catch (error) {
      // 避免日誌通知錯誤導致程式崩潰，但不要輸出到主控台避免汙染MCP輸出
      // console.error('傳送MCP日誌通知失敗:', error);
    }
  }

  // ========== 延遲啟動相關 ==========
  private deferredStartupTriggered = false;

  /**
   * 實作collect_feedback功能
   */
  private async collectFeedback(params: CollectFeedbackParams): Promise<{ feedback: FeedbackData[]; sessionId: string; feedbackUrl: string; projectId: string; projectName: string }> {
    const { work_summary, project_name, project_path } = params;
    const timeout_seconds = this.config.dialogTimeout;

    logger.info(`開始收集回饋，工作匯報長度: ${work_summary.length}字元，逾時: ${timeout_seconds}秒，專案: ${project_name || 'Default'}`);

    // 觸發延遲啟動的 MCP Servers（首次帶有 project_path 時）
    if (project_path && !this.deferredStartupTriggered) {
      this.deferredStartupTriggered = true;
      const { mcpClientManager } = await import('../utils/mcp-client-manager.js');
      const path = await import('path');

      const resolvedProjectName = project_name || path.basename(project_path);
      logger.info(`首次收到專案資訊，啟動延遲的 MCP Servers: ${resolvedProjectName} @ ${project_path}`);

      mcpClientManager.startDeferredServers({
        projectName: resolvedProjectName,
        projectPath: project_path
      }).catch(err => {
        logger.error('延遲 MCP Server 啟動失敗:', err);
      });
    }

    // 傳送MCP工具呼叫開始通知
    logger.mcpToolCallStarted('collect_feedback', {
      work_summary_length: work_summary.length,
      timeout_seconds: timeout_seconds,
      project_name: project_name
    });

    try {
      // 啟動Web伺服器（如果未執行）
      if (!this.webServer.isRunning()) {
        await this.webServer.start();
      }

      // 收集使用者回饋（webServer.collectFeedback 已回傳 { feedback, sessionId, feedbackUrl, projectId, projectName }）
      const result = await this.webServer.collectFeedback(work_summary, timeout_seconds, project_name, project_path);

      logger.info(`回饋收集流程已完成（可能為空），會話: ${result.sessionId}，專案: ${result.projectName}`);

      return result;

    } catch (error) {
      logger.error('回饋收集失敗:', error);
      if (error instanceof MCPError) throw error;
      throw new MCPError('Failed to collect user feedback', 'COLLECT_FEEDBACK_ERROR', error);
    }
  }

  /**
   * 將回饋資料格式化為MCP內容（支援圖片顯示）
   */
  private formatFeedbackForMCP(feedback: FeedbackData[]): (TextContent | ImageContent)[] {
    if (feedback.length === 0) {
      return [{
        type: 'text',
        text: '未收到使用者回饋'
      }];
    }

    const content: (TextContent | ImageContent)[] = [];

    // 新增總結文字
    content.push({
      type: 'text',
      text: `收到 ${feedback.length} 條使用者回饋：\n`
    });

    feedback.forEach((item, index) => {
      // 新增回饋標題
      content.push({
        type: 'text',
        text: `\n--- 回饋 ${index + 1} ---`
      });

      // 新增文字回饋
      if (item.text) {
        content.push({
          type: 'text',
          text: `文字回饋: ${item.text}`
        });
      }

      // 新增圖片（轉換為base64格式）
      if (item.images && item.images.length > 0) {
        content.push({
          type: 'text',
          text: `圖片數量: ${item.images.length}`
        });

        item.images.forEach((img: ImageData, imgIndex: number) => {
          // 新增圖片資訊
          content.push({
            type: 'text',
            text: `圖片 ${imgIndex + 1}: ${img.name} (${img.type}, ${(img.size / 1024).toFixed(1)}KB)`
          });

          // 新增圖片描述（如果有）
          if (item.imageDescriptions && item.imageDescriptions[imgIndex]) {
            content.push({
              type: 'text',
              text: `圖片描述: ${item.imageDescriptions[imgIndex]}`
            });
          }

          // 新增圖片內容（Cursor格式）
          if (img.data) {
            // 確保是純淨的base64資料（移除data:image/...;base64,前綴）
            const base64Data = img.data.replace(/^data:image\/[^;]+;base64,/, '');

            content.push({
              type: 'image',
              data: base64Data, // 純淨的base64字串
              mimeType: img.type
            });
          }
        });
      }

      // 新增時間戳
      content.push({
        type: 'text',
        text: `提交時間: ${new Date(item.timestamp).toLocaleString()}\n`
      });
    });

    return content;
  }

  /**
   * 將回饋資料格式化為文字（保留用於其他用途）
   */
  private formatFeedbackAsText(feedback: FeedbackData[]): string {
    if (feedback.length === 0) {
      return '未收到使用者回饋';
    }

    const parts: string[] = [];
    parts.push(`收到 ${feedback.length} 條使用者回饋：\n`);

    feedback.forEach((item, index) => {
      parts.push(`--- 回饋 ${index + 1} ---`);

      if (item.text) {
        parts.push(`文字回饋: ${item.text}`);
      }

      if (item.images && item.images.length > 0) {
        parts.push(`圖片數量: ${item.images.length}`);
        item.images.forEach((img: ImageData, imgIndex: number) => {
          parts.push(`  圖片 ${imgIndex + 1}: ${img.name} (${img.type}, ${(img.size / 1024).toFixed(1)}KB)`);
        });
      }

      parts.push(`提交時間: ${new Date(item.timestamp).toLocaleString()}`);
      parts.push('');
    });

    return parts.join('\n');
  }

  /**
   * 啟動MCP伺服器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MCP伺服器已在執行中');
      return;
    }

    try {
      logger.info('正在啟動MCP伺服器...');

      // 連線 MCP傳輸
      const transport = new StdioServerTransport();

      // 設定傳輸錯誤處理
      transport.onerror = (error: Error) => {
        logger.error('MCP傳輸錯誤:', error);
      };

      transport.onclose = () => {
        logger.info('MCP傳輸連線已關閉');
        this.isRunning = false;
      };

      // 新增訊息除錯
      const originalOnMessage = transport.onmessage;
      transport.onmessage = (message) => {
        logger.debug('📥 收到MCP消息:', JSON.stringify(message, null, 2));
        if (originalOnMessage) {
          originalOnMessage(message);
        }
      };

      const originalSend = transport.send.bind(transport);
      transport.send = (message) => {
        logger.debug('📤 发送MCP消息:', JSON.stringify(message, null, 2));
        return originalSend(message);
      };

      await this.mcpServer.connect(transport);

      // 啟動Web伺服器（非阻塞，讓 MCP initialize 可以先完成回應）
      // 使用 setImmediate 確保 MCP 連接的 initialize 回應先發送
      setImmediate(() => {
        this.webServer.start().then(() => {
          logger.info('Web伺服器啟動成功');
        }).catch((error) => {
          logger.error('Web伺服器啟動失敗:', error);
        });
      });

      this.isRunning = true;
      logger.info('MCP伺服器啟動成功');

      // 保持進程運行（即使 stdin 關閉）
      process.stdin.resume();

    } catch (error) {
      logger.error('MCP伺服器啟動失敗:', error);
      throw new MCPError(
        'Failed to start MCP server',
        'SERVER_START_ERROR',
        error
      );
    }
  }

  /**
   * 僅啟動Web模式
   */
  async startWebOnly(): Promise<void> {
    try {
      logger.info('正在啟動Web模式...');

      // 僅啟動Web伺服器
      await this.webServer.start();

      this.isRunning = true;
      logger.info('Web伺服器啟動成功');

      // 保持處理程序執行
      process.stdin.resume();

    } catch (error) {
      logger.error('Web伺服器啟動失敗:', error);
      throw new MCPError(
        'Failed to start web server',
        'WEB_SERVER_START_ERROR',
        error
      );
    }
  }

  /**
   * 停止伺服器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('正在停止伺服器...');

      // 停止Web伺服器
      await this.webServer.stop();

      // 關閉MCP伺服器
      if (this.mcpServer) {
        await this.mcpServer.close();
      }

      this.isRunning = false;
      logger.info('伺服器已停止');

    } catch (error) {
      logger.error('停止伺服器時出錯:', error);
      throw new MCPError(
        'Failed to stop server',
        'SERVER_STOP_ERROR',
        error
      );
    }
  }

  /**
   * 取得伺服器狀態
   */
  getStatus(): { running: boolean; webPort?: number | undefined } {
    return {
      running: this.isRunning,
      webPort: this.webServer.isRunning() ? this.webServer.getPort() : undefined
    };
  }
}
