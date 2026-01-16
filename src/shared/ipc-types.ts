/**
 * IPC Types for Supervisor-Worker Communication
 */

export type IPCMessageType = 'request' | 'response' | 'event';

export type WorkerStatus = 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed';

export type HealthStatus = 'ok' | 'error' | 'restarted' | 'failed' | 'not_running';

export interface IPCMessage {
  id: string;
  type: IPCMessageType;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: IPCError;
  timestamp: number;
}

export interface IPCError {
  code: number;
  message: string;
  data?: unknown;
}

export interface IPCRequest extends IPCMessage {
  type: 'request';
  method: string;
  params?: unknown;
}

export interface IPCResponse extends IPCMessage {
  type: 'response';
  result?: unknown;
  error?: IPCError;
}

export interface IPCEvent extends IPCMessage {
  type: 'event';
  method: string;
  params?: unknown;
}

export interface WorkerState {
  pid: number | null;
  status: WorkerStatus;
  restartCount: number;
  lastHealthCheck: Date | null;
  lastCrash: Date | null;
  startTime: Date | null;
}

export interface HealthCheckRequest {
  method: 'health_check';
}

export interface HealthCheckResponse {
  status: HealthStatus;
  pid: number;
  uptime: number;
  webServerPort: number | null;
  activeConnections: number;
  databaseConnected: boolean;
}

export interface MCPToolRequest {
  method: 'mcp_tool';
  toolName: string;
  params: unknown;
}

export interface MCPToolResponse {
  result?: unknown;
  error?: IPCError;
}

export interface ShutdownRequest {
  method: 'shutdown';
  graceful: boolean;
}

export interface ReadyEvent {
  method: 'ready';
  pid: number;
  webServerPort: number;
}

export interface ErrorEvent {
  method: 'error';
  error: string;
  stack?: string;
}

export interface SelfTestHealthInfo {
  supervisor: {
    status: HealthStatus;
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  worker: {
    status: HealthStatus;
    pid: number | null;
    uptime: number | null;
    restartCount: number;
  };
  webServer: {
    status: HealthStatus;
    port: number | null;
    activeConnections: number;
  };
  database: {
    status: HealthStatus;
  };
}

export interface AutoRepairInfo {
  action: 'worker_restarted';
  previousPid: number | null;
  newPid: number;
  reason: string;
}

export interface DiagnosticsInfo {
  system: {
    platform: string;
    nodeVersion: string;
    totalMemory: number;
    freeMemory: number;
  };
  restartHistory: Array<{
    timestamp: string;
    reason: string;
  }>;
}

export interface SelfTestResult {
  success: boolean;
  timestamp: string;
  health: SelfTestHealthInfo;
  autoRepair?: AutoRepairInfo;
  diagnostics: DiagnosticsInfo;
  summary: string;
}
