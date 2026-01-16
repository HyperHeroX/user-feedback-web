/**
 * IPC Handler for Worker Process
 * Handles incoming IPC messages from Supervisor
 */

import { randomUUID } from 'crypto';
import {
  IPCMessage,
  IPCRequest,
  IPCResponse,
  IPCEvent,
  HealthCheckResponse,
} from '../shared/ipc-types.js';
import { IPC_METHODS, IPC_ERROR_CODES } from '../shared/ipc-constants.js';

export interface WorkerContext {
  getWebServerPort: () => number | null;
  getActiveConnections: () => number;
  isDatabaseConnected: () => boolean;
  executeMCPTool: (toolName: string, params: unknown) => Promise<unknown>;
  shutdown: () => Promise<void>;
}

export class IPCHandler {
  private context: WorkerContext | null = null;
  private messageBuffer = '';

  constructor() {
    this.setupStdinHandler();
  }

  /**
   * Set the worker context for handling requests
   */
  setContext(context: WorkerContext): void {
    this.context = context;
  }

  /**
   * Send ready event to supervisor
   */
  sendReady(webServerPort: number): void {
    this.sendEvent(IPC_METHODS.READY, {
      pid: process.pid,
      webServerPort,
    });
  }

  /**
   * Send error event to supervisor
   */
  sendError(error: string, stack?: string): void {
    this.sendEvent(IPC_METHODS.ERROR, {
      error,
      stack,
    });
  }

  private setupStdinHandler(): void {
    if (process.stdin) {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (data: string) => {
        this.handleData(data);
      });
    }
  }

  private handleData(data: string): void {
    this.messageBuffer += data;

    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        this.processLine(line);
      }
    }
  }

  private processLine(line: string): void {
    try {
      const message = JSON.parse(line) as IPCMessage;
      this.handleMessage(message);
    } catch {
      // Not JSON, ignore
    }
  }

  private async handleMessage(message: IPCMessage): Promise<void> {
    if (message.type !== 'request') {
      return;
    }

    const request = message as IPCRequest;
    let response: IPCResponse;

    try {
      const result = await this.processRequest(request);
      response = {
        id: request.id,
        type: 'response',
        result,
        timestamp: Date.now(),
      };
    } catch (error) {
      response = {
        id: request.id,
        type: 'response',
        error: {
          code: IPC_ERROR_CODES.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : String(error),
        },
        timestamp: Date.now(),
      };
    }

    this.sendResponse(response);
  }

  private async processRequest(request: IPCRequest): Promise<unknown> {
    if (!this.context) {
      throw new Error('Worker context not set');
    }

    switch (request.method) {
      case IPC_METHODS.HEALTH_CHECK:
        return this.handleHealthCheck();

      case IPC_METHODS.MCP_TOOL:
        return this.handleMCPTool(request.params as { toolName: string; params: unknown });

      case IPC_METHODS.SHUTDOWN:
        return this.handleShutdown(request.params as { graceful: boolean });

      default:
        throw new Error(`Unknown method: ${request.method}`);
    }
  }

  private handleHealthCheck(): HealthCheckResponse {
    if (!this.context) {
      throw new Error('Worker context not set');
    }

    return {
      status: 'ok',
      pid: process.pid,
      uptime: process.uptime() * 1000,
      webServerPort: this.context.getWebServerPort(),
      activeConnections: this.context.getActiveConnections(),
      databaseConnected: this.context.isDatabaseConnected(),
    };
  }

  private async handleMCPTool(params: { toolName: string; params: unknown }): Promise<unknown> {
    if (!this.context) {
      throw new Error('Worker context not set');
    }

    return this.context.executeMCPTool(params.toolName, params.params);
  }

  private async handleShutdown(params: { graceful: boolean }): Promise<{ success: boolean }> {
    if (!this.context) {
      return { success: true };
    }

    if (params.graceful) {
      await this.context.shutdown();
    }

    return { success: true };
  }

  private sendResponse(response: IPCResponse): void {
    this.sendToStdout(response);
  }

  private sendEvent(method: string, params?: unknown): void {
    const event: IPCEvent = {
      id: randomUUID(),
      type: 'event',
      method,
      params,
      timestamp: Date.now(),
    };
    this.sendToStdout(event);
  }

  private sendToStdout(message: IPCMessage): void {
    if (process.stdout?.writable) {
      process.stdout.write(JSON.stringify(message) + '\n');
    }
  }
}
