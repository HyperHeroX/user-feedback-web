/**
 * IPC Bridge for Supervisor-Worker Communication
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import {
  IPCMessage,
  IPCRequest,
  IPCResponse,
  IPCError,
} from '../shared/ipc-types.js';
import { IPC_ERROR_CODES, SUPERVISOR_DEFAULTS } from '../shared/ipc-constants.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class IPCBridge extends EventEmitter {
  private worker: ChildProcess | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private messageBuffer = '';
  private requestTimeout: number;

  constructor(requestTimeout: number = SUPERVISOR_DEFAULTS.REQUEST_TIMEOUT_MS) {
    super();
    this.requestTimeout = requestTimeout;
  }

  /**
   * Attach to a worker process
   */
  attach(worker: ChildProcess): void {
    this.worker = worker;

    if (worker.stdout) {
      worker.stdout.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });
    }

    if (worker.stderr) {
      worker.stderr.on('data', (data: Buffer) => {
        this.emit('worker:stderr', data.toString());
      });
    }

    worker.on('exit', (code, signal) => {
      this.handleWorkerExit(code, signal);
    });

    worker.on('error', (error) => {
      this.emit('worker:error', error);
    });
  }

  /**
   * Detach from worker process
   */
  detach(): void {
    this.worker = null;
    this.rejectAllPending(new Error('Worker detached'));
  }

  /**
   * Send a request to the worker and wait for response
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.worker || !this.worker.stdin) {
      throw new Error('Worker not attached or stdin not available');
    }

    const id = randomUUID();
    const request: IPCRequest = {
      id,
      type: 'request',
      method,
      params,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.sendMessage(request);
    });
  }

  /**
   * Send an event to the worker (no response expected)
   */
  send(method: string, params?: unknown): void {
    if (!this.worker || !this.worker.stdin) {
      return;
    }

    const message: IPCMessage = {
      id: randomUUID(),
      type: 'event',
      method,
      params,
      timestamp: Date.now(),
    };

    this.sendMessage(message);
  }

  /**
   * Check if worker is connected
   */
  isConnected(): boolean {
    return this.worker !== null && !this.worker.killed;
  }

  /**
   * Get pending request count
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  private sendMessage(message: IPCMessage): void {
    if (!this.worker?.stdin?.writable) {
      return;
    }

    try {
      const serialized = JSON.stringify(message) + '\n';
      this.worker.stdin.write(serialized);
    } catch (error) {
      this.emit('send:error', error);
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
      // Not JSON, emit as raw output
      this.emit('worker:output', line);
    }
  }

  private handleMessage(message: IPCMessage): void {
    if (message.type === 'response') {
      this.handleResponse(message as IPCResponse);
    } else if (message.type === 'event') {
      this.emit('worker:event', message);
    }
  }

  private handleResponse(response: IPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      const error = new Error(response.error.message);
      (error as Error & { code: number }).code = response.error.code;
      pending.reject(error);
    } else {
      pending.resolve(response.result);
    }
  }

  private handleWorkerExit(code: number | null, signal: string | null): void {
    const error = new Error(
      `Worker exited with code ${code}, signal ${signal}`
    );
    this.rejectAllPending(error);
    this.emit('worker:exit', { code, signal });
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * Create an IPC error object
   */
  static createError(
    code: number,
    message: string,
    data?: unknown
  ): IPCError {
    return { code, message, data };
  }

  static ErrorCodes = IPC_ERROR_CODES;
}
