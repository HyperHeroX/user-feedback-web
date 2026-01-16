# Design: Self-Probe (Keep-Alive) Feature

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Settings UI                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Self-Probe Settings                                     │   │
│  │  ├── Enable/Disable Toggle                               │   │
│  │  └── Interval Seconds Input (60-600s)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP API
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         WebServer                               │
│  ┌───────────────┐    ┌──────────────────┐                     │
│  │ SelfProbe     │◄───│ Config           │                     │
│  │ Service       │    │ (enableSelfProbe,│                     │
│  │               │    │  interval)       │                     │
│  └───────┬───────┘    └──────────────────┘                     │
│          │                                                      │
│          │  Interval Timer                                      │
│          ▼                                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Health Checks                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │ Socket.IO   │  │ MCP Server  │  │ Session     │       │ │
│  │  │ Ping/Pong   │  │ Status      │  │ Cleanup     │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Status Events
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        MCPServer                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Status Endpoint: /api/health                            │   │
│  │  - Server running status                                 │   │
│  │  - Active sessions count                                 │   │
│  │  - Last probe timestamp                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Configuration Extension

**File**: `src/config/index.ts`

```typescript
interface Config {
  // ... existing fields ...
  
  // Self-Probe Configuration
  enableSelfProbe: boolean;      // Default: false
  selfProbeIntervalSeconds: number;  // Default: 300 (5 minutes), Range: 60-600
}
```

**Environment Variables**:
- `MCP_ENABLE_SELF_PROBE`: boolean, default `false`
- `MCP_SELF_PROBE_INTERVAL`: number, default `300`

### 2. SelfProbeService Class

**File**: `src/utils/self-probe-service.ts`

```typescript
class SelfProbeService {
  private timer: NodeJS.Timeout | null = null;
  private lastProbeTime: Date | null = null;
  private probeCount: number = 0;
  
  constructor(
    private webServer: WebServer,
    private config: Config
  ) {}
  
  start(): void {
    if (!this.config.enableSelfProbe) return;
    
    const intervalMs = this.config.selfProbeIntervalSeconds * 1000;
    this.timer = setInterval(() => this.probe(), intervalMs);
    logger.info(`Self-probe started with interval: ${intervalMs}ms`);
  }
  
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Self-probe stopped');
    }
  }
  
  private async probe(): Promise<void> {
    this.lastProbeTime = new Date();
    this.probeCount++;
    
    try {
      // 1. Check Socket.IO connections
      await this.checkSocketIO();
      
      // 2. Check MCP server status
      await this.checkMCPStatus();
      
      // 3. Trigger session cleanup
      this.webServer.getSessionStorage().cleanupExpiredSessions();
      
      logger.debug(`Self-probe #${this.probeCount} completed`);
    } catch (error) {
      logger.warn('Self-probe encountered an issue:', error);
    }
  }
  
  private checkSocketIO(): void {
    // Socket.IO has built-in ping/pong, just log connected clients
    const connectedSockets = this.webServer.getIO().sockets.sockets.size;
    logger.debug(`Socket.IO connected clients: ${connectedSockets}`);
  }
  
  private checkMCPStatus(): void {
    const mcpStatus = this.webServer.getMCPServer()?.getStatus();
    logger.debug(`MCP Server running: ${mcpStatus?.running}`);
  }
  
  getStats(): SelfProbeStats {
    return {
      enabled: this.config.enableSelfProbe,
      intervalSeconds: this.config.selfProbeIntervalSeconds,
      lastProbeTime: this.lastProbeTime,
      probeCount: this.probeCount,
      isRunning: this.timer !== null
    };
  }
}
```

### 3. Settings API Extension

**File**: `src/server/web-server.ts`

新增 API 端點：
- `GET /api/settings/self-probe` - 獲取 Self-Probe 設定
- `POST /api/settings/self-probe` - 更新 Self-Probe 設定

```typescript
// GET /api/settings/self-probe
app.get('/api/settings/self-probe', (req, res) => {
  const settings = database.getSelfProbeSettings();
  res.json({
    enabled: settings?.enabled ?? false,
    intervalSeconds: settings?.intervalSeconds ?? 300
  });
});

// POST /api/settings/self-probe
app.post('/api/settings/self-probe', (req, res) => {
  const { enabled, intervalSeconds } = req.body;
  
  // Validate
  if (intervalSeconds && (intervalSeconds < 60 || intervalSeconds > 600)) {
    return res.status(400).json({ error: 'Interval must be 60-600 seconds' });
  }
  
  database.saveSelfProbeSettings({ enabled, intervalSeconds });
  
  // Apply changes
  if (enabled) {
    selfProbeService.start();
  } else {
    selfProbeService.stop();
  }
  
  res.json({ success: true });
});
```

### 4. Settings UI

**File**: `src/static/settings.html`

在「用戶偏好」區塊後新增：

```html
<!-- Self-Probe 設定 -->
<section class="settings-section">
    <h2 class="section-title">
        <span class="icon">💓</span>
        自我探查 (Keep-Alive)
    </h2>
    
    <div class="form-group">
        <div class="checkbox-group">
            <input type="checkbox" id="enableSelfProbe" />
            <label for="enableSelfProbe">啟用自我探查</label>
        </div>
        <p class="form-help">定期檢查服務狀態，防止因閒置被系統回收</p>
    </div>

    <div class="form-group" id="selfProbeIntervalGroup">
        <label class="form-label" for="selfProbeInterval">探查間隔（秒）</label>
        <input type="number" id="selfProbeInterval" class="form-input" 
               min="60" max="600" step="30" value="300">
        <p class="form-help">60-600 秒，預設 300 秒（5 分鐘）</p>
    </div>

    <div class="form-actions">
        <button id="saveSelfProbeBtn" class="btn btn-primary">儲存設定</button>
    </div>
</section>
```

### 5. Database Schema Extension

**File**: `src/utils/database.ts`

```sql
CREATE TABLE IF NOT EXISTS self_probe_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER DEFAULT 0,
  interval_seconds INTEGER DEFAULT 300,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## System Stability Enhancements

### 1. Process Exit Review

**Current Issues**:
```typescript
// cli.ts - 直接退出，可能丟失數據
process.exit(1);
```

**Enhanced Approach**:
```typescript
// 使用優雅關閉而非直接退出
async function gracefulExit(code: number, reason: string): Promise<never> {
  logger.info(`Initiating graceful exit: ${reason}`);
  
  try {
    // 1. 停止接收新請求
    // 2. 等待現有操作完成
    // 3. 清理資源
    await cleanup();
  } catch (error) {
    logger.error('Cleanup error during exit:', error);
  }
  
  process.exit(code);
}
```

### 2. Timer Lifecycle Management

**Pattern**:
```typescript
class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  
  add(id: string, timer: NodeJS.Timeout): void {
    this.clear(id); // Clear existing
    this.timers.set(id, timer);
  }
  
  clear(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(id);
    }
  }
  
  clearAll(): void {
    for (const [id] of this.timers) {
      this.clear(id);
    }
  }
}
```

### 3. Error Boundary Enhancement

**Pattern**:
```typescript
// 全局錯誤邊界
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception:', error);
  
  // 嘗試恢復而非立即退出
  if (isRecoverable(error)) {
    await attemptRecovery(error);
    return;
  }
  
  // 無法恢復時優雅關閉
  await gracefulShutdown('uncaught-exception');
});
```

## Security Considerations

1. **Rate Limiting**: Self-probe 不應過於頻繁（最小 60 秒）
2. **Resource Usage**: 探測操作應輕量，不影響正常服務
3. **Logging**: 避免過多日誌輸出（使用 debug 級別）

## Performance Impact

| Operation | Expected Impact |
|-----------|-----------------|
| Self-probe check | < 10ms |
| Socket.IO ping | Built-in, negligible |
| Session cleanup | O(n) where n = expired sessions |

## Rollback Plan

如需回滾：
1. 在設定頁面關閉 Self-Probe
2. 或設定環境變數 `MCP_ENABLE_SELF_PROBE=false`
3. 或回退到之前版本
