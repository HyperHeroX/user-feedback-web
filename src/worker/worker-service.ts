/**
 * Worker Service
 * Manages all worker-level services (WebServer, MCPClientManager, etc.)
 */

import { WebServer } from '../server/web-server.js';
import { IPCHandler, WorkerContext } from './ipc-handler.js';
import { getConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { getDatabase } from '../utils/database.js';
import type { Config } from '../types/index.js';

export class WorkerService {
  private config: Config;
  private webServer: WebServer;
  private ipcHandler: IPCHandler;
  private isRunning = false;

  constructor() {
    this.config = getConfig();
    this.webServer = new WebServer(this.config);
    this.ipcHandler = new IPCHandler();
  }

  /**
   * Start the worker service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    logger.info('Worker starting...');

    // Setup IPC context before starting services
    this.setupIPCContext();

    // Start WebServer
    await this.webServer.start();
    this.isRunning = true;

    // Notify supervisor that we're ready
    this.ipcHandler.sendReady(this.config.webPort);

    logger.info(`Worker ready (PID: ${process.pid}, Port: ${this.config.webPort})`);
  }

  /**
   * Stop the worker service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Worker stopping...');

    try {
      await this.webServer.stop();
    } catch (error) {
      logger.error('Error stopping WebServer:', error);
    }

    this.isRunning = false;
    logger.info('Worker stopped');
  }

  /**
   * Get running status
   */
  getIsRunning(): boolean {
    return this.isRunning;
  }

  private setupIPCContext(): void {
    const context: WorkerContext = {
      getWebServerPort: () => this.isRunning ? this.config.webPort : null,
      
      getActiveConnections: () => {
        try {
          return this.webServer.getIO()?.sockets.sockets.size ?? 0;
        } catch {
          return 0;
        }
      },
      
      isDatabaseConnected: () => {
        try {
          const db = getDatabase();
          return db !== null;
        } catch {
          return false;
        }
      },
      
      executeMCPTool: async (toolName: string, params: unknown) => {
        // This would need to be connected to the actual MCP tool implementation
        // For now, return an error indicating tools should be proxied differently
        throw new Error(`Tool ${toolName} should be handled by worker's MCP handler`);
      },
      
      shutdown: async () => {
        await this.stop();
      },
    };

    this.ipcHandler.setContext(context);
  }
}
