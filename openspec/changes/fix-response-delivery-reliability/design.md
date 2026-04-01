# fix-response-delivery-reliability — Technical Design

## Architecture Overview

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   MCP Client     │     │   MCP Server     │     │   Web UI         │
│   (Cursor)       │◀────│   (mcp-server)   │◀────│   (Socket.IO)    │
│                  │     │                  │     │                  │
│ collect_feedback │     │ ┌──────────────┐ │     │ submit_feedback  │
│ ────────────────▶│     │ │ ResponseStore│ │     │ ────────────────▶│
│                  │     │ │  (SQLite)    │ │     │                  │
│ ◀── result ──── │     │ └──────────────┘ │     │                  │
│                  │     │ ┌──────────────┐ │     │                  │
│ Poll /api/...   │     │ │ Transport    │ │     │                  │
│ ────────────────▶│     │ │ HealthCheck  │ │     │                  │
│                  │     │ └──────────────┘ │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

## Component Design

### 1. ResponseStore (新增模組)

**位置**: `src/utils/response-store.ts`

**職責**: 管理未送達回應的持久化存儲

```typescript
interface PendingResponse {
  id: string;
  sessionId: string;
  projectId: string;
  projectName: string;
  feedbackJson: string;        // JSON serialized FeedbackData[]
  feedbackUrl: string;
  createdAt: number;           // timestamp
  delivered: boolean;
  deliveryAttempts: number;
  lastAttemptAt: number | null;
  expiresAt: number;           // createdAt + TTL
}
```

**Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS pending_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  project_name TEXT DEFAULT '',
  feedback_json TEXT NOT NULL,
  feedback_url TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  delivered INTEGER DEFAULT 0,
  delivery_attempts INTEGER DEFAULT 0,
  last_attempt_at INTEGER,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_pending_responses_project ON pending_responses(project_id, delivered);
CREATE INDEX idx_pending_responses_expires ON pending_responses(expires_at);
```

**API**:
- `savePendingResponse(response)`: 儲存待送達回應
- `getPendingByProject(projectId)`: 取得專案最新未送達回應
- `markDelivered(id)`: 標記為已送達
- `cleanupExpired()`: 清理過期記錄

### 2. Transport Health Detection

**修改**: `src/server/web-server.ts`

**Stdio 心跳偵測**:
- 在 MCP Server connect 後，啟動週期性 notification ping（每 30 秒）
- 若 notification 拋出異常或 write 失敗，標記 transport 為 unhealthy
- 新增 `isTransportHealthy(): boolean` 方法供 feedback submission 使用

**統一介面**:
```typescript
interface TransportHealthChecker {
  isHealthy(): boolean;
  getMode(): 'stdio' | 'sse' | 'streamable-http';
}
```

### 3. Feedback Submission 流程改造

**修改**: `web-server.ts` `handleFeedbackSubmission()`

**改造後流程**:
1. 用戶提交回饋 → 處理圖片 → 更新 session feedback
2. **立即寫入 ResponseStore**（持久化）
3. 檢查 Transport 健康狀態
4. 若健康 → `session.resolve()` + 標記 delivered
5. 若不健康 → 保留在 DB，回應 UI「已儲存，等待 AI 客戶端重連」
6. 無論結果，UI 都顯示「提交成功」

### 4. collect_feedback 復原邏輯

**修改**: `mcp-server.ts` `collectFeedback()`

**改造後流程**:
1. 收到 collect_feedback 呼叫
2. **先檢查 ResponseStore 是否有未送達回應**（優先於建立新 session）
3. 若有 → 取出、標記 delivered、直接回傳
4. 若無 → 走原有的建立 session + 等待 Promise 流程
5. Promise resolve 後，也要嘗試寫入 ResponseStore 作為備份

### 5. 輪詢 API 端點

**新增端點**:

```
GET  /api/pending-response/:projectId
POST /api/pending-response/:responseId/ack
```

- GET: 回傳指定專案最新的未送達回應（若有）
- POST ack: 客戶端確認收到，標記 delivered

**用途**: 當 MCP transport 失敗時，客戶端（或人工操作）可透過此端點取回回應。

### 6. 清理策略

- 定期清理（每小時）已過期的 pending_responses
- 預設 TTL: 24 小時（可配置 `MCP_RESPONSE_TTL`）
- 已送達的記錄保留 1 小時後清理

## Data Flow: Happy Path (Transport 正常)

```
Cursor → collect_feedback → WebServer.collectFeedback() → Session Created
                                                              ↓
User opens Web UI → submits feedback → handleFeedbackSubmission()
                                              ↓
                                    ResponseStore.save() ← DB 持久化
                                              ↓
                                    Transport healthy? → YES
                                              ↓
                                    session.resolve(feedback)
                                              ↓
                                    ResponseStore.markDelivered()
                                              ↓
                                    Result → Cursor (via MCP transport)
```

## Data Flow: Recovery Path (Transport 斷線)

```
Cursor → collect_feedback → [Transport breaks during wait]
                                              ↓
User submits feedback → handleFeedbackSubmission()
                                              ↓
                              ResponseStore.save() ← DB 持久化
                                              ↓
                              Transport healthy? → NO
                                              ↓
                              session.resolve(feedback) ← 嘗試但可能失敗
                                              ↓
                              Response stays UNDELIVERED in DB
                                              ↓
[Later] Cursor retries collect_feedback
                                              ↓
                              Check ResponseStore → Found undelivered!
                                              ↓
                              Return cached response → markDelivered()
                                              ↓
                              Cursor gets the feedback ✅
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| MCP_RESPONSE_TTL | 86400 | 未送達回應保留時間（秒）|
| MCP_STDIO_HEARTBEAT_INTERVAL | 30 | stdio 心跳間隔（秒）|

## Trade-offs

1. **DB 寫入開銷 vs 可靠性**: 每次回饋提交多一次 DB 寫入，但 SQLite 本地 I/O 極快
2. **輪詢 vs 推送**: 輪詢端點是 fallback，主要仍使用 Transport 推送
3. **複雜度**: 新增 ~200 行程式碼，但大幅提升系統可靠性
