# Technical Design: MCP Supervisor

## Architecture Overview

### Process Model

```
┌────────────────────────────────────────────────────────────────────┐
│                          Cursor IDE                                 │
└────────────────────────────────┬───────────────────────────────────┘
                                 │ stdio/SSE/HTTP
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                    SUPERVISOR PROCESS                               │
│                    (src/supervisor/index.ts)                        │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │   MCP Handler    │  │  Health Monitor  │  │  Worker Manager  │ │
│  │                  │  │                  │  │                  │ │
│  │ • Route requests │  │ • Check health   │  │ • Spawn worker   │ │
│  │ • Queue pending  │  │ • Track metrics  │  │ • Restart logic  │ │
│  │ • Return results │  │ • Alert on fail  │  │ • IPC bridge     │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│           │                     │                      │           │
│           └─────────────────────┼──────────────────────┘           │
│                                 │                                   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │ IPC (stdio JSON-RPC)
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                      WORKER PROCESS                                 │
│                      (src/worker/index.ts)                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
│  │    Web Server    │  │   MCP Tools      │  │    Database      │ │
│  │                  │  │                  │  │                  │ │
│  │ • Express        │  │ • collect_feed.. │  │ • SQLite         │ │
│  │ • Socket.IO      │  │ • (new tools)    │  │ • Settings       │ │
│  │ • API Routes     │  │                  │  │ • Logs           │ │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │  MCP Clients     │  │  Self-Probe      │                        │
│  │                  │  │                  │                        │
│  │ • Manager        │  │ • Keep-alive     │                        │
│  │ • Connections    │  │ • Health checks  │                        │
│  └──────────────────┘  └──────────────────┘                        │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Supervisor Process

#### 1.1 SupervisorService

**File**: `src/supervisor/supervisor-service.ts`

```typescript
interface SupervisorConfig {
  workerScript: string;
  maxRestartAttempts: number;
  restartDelayMs: number;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
}

interface WorkerState {
  pid: number | null;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed';
  restartCount: number;
  lastHealthCheck: Date | null;
  lastCrash: Date | null;
}

class SupervisorService {
  private config: SupervisorConfig;
  private worker: ChildProcess | null;
  private state: WorkerState;
  private pendingRequests: Map<string, PendingRequest>;
  
  constructor(config: SupervisorConfig);
  
  // Worker Lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async restart(): Promise<void>;
  
  // Health Monitoring
  private startHealthMonitor(): void;
  private checkWorkerHealth(): Promise<boolean>;
  
  // IPC Communication
  private sendToWorker(message: IPCMessage): Promise<any>;
  private handleWorkerMessage(message: IPCMessage): void;
  
  // MCP Request Handling
  async handleMCPRequest(request: MCPRequest): Promise<MCPResponse>;
  
  // Status & Diagnostics
  getStatus(): SupervisorStatus;
  getDiagnostics(): DiagnosticsInfo;
}
```

#### 1.2 MCP Proxy Handler

**File**: `src/supervisor/mcp-proxy.ts`

```typescript
class MCPProxyHandler {
  private supervisor: SupervisorService;
  private mcpServer: Server;
  
  constructor(supervisor: SupervisorService);
  
  // Setup MCP tools that run in supervisor
  private setupSupervisorTools(): void;
  
  // Proxy tools that delegate to worker
  private setupProxyTools(): void;
  
  // Built-in supervisor tool: unified self-test with auto-repair
  async selfTest(): Promise<SelfTestResult>;
}
```

### 2. Worker Process

#### 2.1 WorkerService

**File**: `src/worker/worker-service.ts`

```typescript
class WorkerService {
  private webServer: WebServer;
  private mcpClientManager: MCPClientManager;
  
  constructor(config: Config);
  
  async start(): Promise<void>;
  async stop(): Promise<void>;
  
  // IPC message handling from supervisor
  handleIPCRequest(request: IPCRequest): Promise<IPCResponse>;
  
  // Health check endpoint
  getHealthStatus(): HealthStatus;
}
```

### 3. IPC Protocol

#### 3.1 Message Format

```typescript
interface IPCMessage {
  id: string;
  type: 'request' | 'response' | 'event';
  method?: string;
  params?: any;
  result?: any;
  error?: IPCError;
}

interface IPCError {
  code: number;
  message: string;
  data?: any;
}
```

#### 3.2 Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `health_check` | Supervisor → Worker | 檢查 Worker 健康狀態 |
| `health_response` | Worker → Supervisor | 返回健康狀態 |
| `mcp_request` | Supervisor → Worker | 代理 MCP 工具請求 |
| `mcp_response` | Worker → Supervisor | 返回 MCP 工具結果 |
| `shutdown` | Supervisor → Worker | 優雅關閉指令 |
| `ready` | Worker → Supervisor | Worker 啟動完成通知 |
| `error` | Worker → Supervisor | 錯誤通知 |

### 4. New MCP Tool: self_test

統一的自我診斷與修復工具，整合健康檢查、自動重啟和診斷資訊。

```typescript
interface SelfTestResult {
  success: boolean;
  timestamp: string;
  
  // 健康檢查結果
  health: {
    supervisor: {
      status: 'ok' | 'error';
      pid: number;
      uptime: number;
      memoryUsage: NodeJS.MemoryUsage;
    };
    worker: {
      status: 'ok' | 'restarted' | 'failed';
      pid: number | null;
      uptime: number | null;
      restartCount: number;
    };
    webServer: {
      status: 'ok' | 'error' | 'not_running';
      port: number | null;
      activeConnections: number;
    };
    database: {
      status: 'ok' | 'error';
    };
  };
  
  // 自動修復操作（如果有）
  autoRepair?: {
    action: 'worker_restarted';
    previousPid: number | null;
    newPid: number;
    reason: string;
  };
  
  // 診斷資訊
  diagnostics: {
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
  };
  
  // 總結訊息
  summary: string;
}
```

**行為邏輯**：
1. 檢查 Supervisor 狀態
2. 檢查 Worker 狀態
   - 若 Worker 失效或不健康 → 自動重啟
   - 記錄重啟操作到 `autoRepair`
3. 檢查 Web Server 狀態
4. 檢查 Database 連線
5. 收集診斷資訊
6. 生成總結訊息
7. 返回完整結果

### 5. Configuration Extension

#### 5.1 Config Updates

**File**: `src/config/index.ts`

```typescript
interface SupervisorConfig {
  enabled: boolean;
  maxRestartAttempts: number;
  restartDelayMs: number;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
}

// Environment variables
SUPERVISOR_ENABLED=true
SUPERVISOR_MAX_RESTART_ATTEMPTS=5
SUPERVISOR_RESTART_DELAY_MS=2000
SUPERVISOR_HEALTH_CHECK_INTERVAL_MS=30000
SUPERVISOR_HEALTH_CHECK_TIMEOUT_MS=5000
```

### 6. Entry Points

#### 6.1 Supervisor Entry (New)

**File**: `src/supervisor/index.ts`

```typescript
// 作為 MCP Server 的入口點
// 啟動 Supervisor，由 Supervisor 管理 Worker
```

#### 6.2 Worker Entry (New)

**File**: `src/worker/index.ts`

```typescript
// 作為 Worker Process 的入口點
// 由 Supervisor spawn，通過 IPC 通訊
```

#### 6.3 CLI Updates

**File**: `src/cli.ts`

```typescript
// 更新啟動命令以支持 supervisor 模式
program
  .command('start')
  .option('--no-supervisor', '禁用 supervisor 模式')
  .action(async (options) => {
    if (options.supervisor) {
      // 啟動 Supervisor 模式
    } else {
      // 啟動傳統模式（向後相容）
    }
  });
```

## Startup Sequence

```
1. CLI 啟動 (cli.ts)
   │
   ├─[supervisor mode]──────────────────────────────────────┐
   │                                                         │
   │  2. SupervisorService.start()                          │
   │     │                                                   │
   │     ├── 3. Setup MCP Transport (stdio/sse/http)        │
   │     │                                                   │
   │     ├── 4. Setup Supervisor MCP Tool                   │
   │     │       • self_test (with auto-repair)             │
   │     │                                                   │
   │     ├── 5. Spawn Worker Process                        │
   │     │       child_process.fork('worker/index.ts')      │
   │     │                                                   │
   │     └── 6. Start Health Monitor                        │
   │                                                         │
   │  Worker Process:                                        │
   │     7. WorkerService.start()                           │
   │        │                                                │
   │        ├── 8. Initialize WebServer                     │
   │        │                                                │
   │        ├── 9. Initialize MCP Client Manager            │
   │        │                                                │
   │        ├── 10. Initialize Self-Probe Service           │
   │        │                                                │
   │        └── 11. Send 'ready' to Supervisor              │
   │                                                         │
   └─[legacy mode]──────────────────────────────────────────┘
```

## Error Recovery Flow

```
Worker Crash Detected
      │
      ▼
┌─────────────────────────────────────┐
│  Health Check Failure OR            │
│  Worker Process Exit                │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Queue Pending MCP Requests         │
│  (Timeout: 30s)                     │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Check Restart Attempts             │
│  (Max: 5)                           │
└───────────────┬─────────────────────┘
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
 [< max attempts]   [>= max attempts]
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────────┐
│ Restart      │  │ Report Fatal     │
│ Worker       │  │ Error to MCP     │
└──────┬───────┘  └──────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Wait for 'ready' from Worker       │
│  (Timeout: 10s)                     │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Resume Pending Requests            │
└─────────────────────────────────────┘
```

## File Structure

```
src/
├── supervisor/
│   ├── index.ts              # Supervisor 入口點
│   ├── supervisor-service.ts # 核心 Supervisor 邏輯
│   ├── mcp-proxy.ts          # MCP 代理處理器
│   ├── ipc-bridge.ts         # IPC 通訊層
│   └── health-monitor.ts     # 健康監控
│
├── worker/
│   ├── index.ts              # Worker 入口點
│   ├── worker-service.ts     # Worker 核心邏輯
│   └── ipc-handler.ts        # IPC 請求處理
│
├── shared/
│   ├── ipc-types.ts          # IPC 消息類型定義
│   └── ipc-constants.ts      # IPC 常量
│
└── ... (existing files)
```

## Testing Strategy

### Unit Tests

1. **SupervisorService Tests**
   - Worker spawn/kill
   - Restart logic
   - Health check

2. **IPC Bridge Tests**
   - Message serialization
   - Request/response matching
   - Timeout handling

3. **MCP Proxy Tests**
   - Request routing
   - Error handling
   - Tool execution

### Integration Tests

1. **Full Supervisor Flow**
   - Start → Worker Ready → Handle Requests → Stop

2. **Crash Recovery**
   - Worker Crash → Auto Restart → Resume Requests

3. **MCP Tool Tests**
   - self_test execution
   - restart_worker execution
   - get_diagnostics execution

## Performance Considerations

1. **IPC Overhead**
   - 使用 stdio streams 減少延遲
   - 批量處理可能的話

2. **Memory**
   - Supervisor 保持最小狀態
   - 避免在 Supervisor 中緩存大量資料

3. **Startup Time**
   - Worker 預熱
   - 並行初始化

## Security Considerations

1. **IPC Isolation**
   - Worker 只通過 IPC 與 Supervisor 通訊
   - 不直接暴露 Worker 的任何端口給外部

2. **Privilege Separation**
   - Supervisor 和 Worker 可以在不同權限級別運行（未來）

## Migration Path

### Phase 1: 新增 Supervisor 支持（非破壞性）
- 新增 supervisor 模式
- 保留傳統模式作為 fallback
- 默認禁用 supervisor

### Phase 2: 默認啟用 Supervisor
- 經過測試後默認啟用
- 傳統模式仍可通過 `--no-supervisor` 使用

### Phase 3: 完全遷移
- 移除傳統模式代碼
- 簡化架構
