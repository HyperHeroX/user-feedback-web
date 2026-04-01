# fix-response-delivery-reliability

## Summary

修復 MCP Client（特別是 Cursor）無法準確收到用戶回饋回應的問題。當用戶在 Web UI 提交回饋後，系統呼叫 `session.resolve()` 但 MCP Transport（stdio/HTTP）可能已斷線，導致回應無法送達，Cursor 一直等待。

## Problem Analysis

### 根本原因

1. **resolve() ≠ 已送達**：`session.resolve(feedback)` 僅解決了 in-process 的 Promise，但不保證 MCP Transport 層已成功將結果傳回客戶端。
2. **stdio 無法偵測斷線**：`waitForActiveConnection()` 僅檢查 HTTP Transport（SSE/Streamable-HTTP），對 stdio 模式完全無效。stdio pipe 斷裂是靜默的。
3. **in-memory 快取壽命太短**：`pendingDeliveryCache` 僅保存 60 秒且在記憶體中，伺服器重啟即遺失。
4. **無 ACK 機制**：系統假設 `resolve()` 即「送達」，缺乏客戶端確認機制。
5. **Cursor 不會自動重試 collect_feedback**：Cursor 等待 tool call response，不會主動重新呼叫。

### 現有緩解措施的不足

| 機制 | 問題 |
|------|------|
| `pendingDeliveryCache` | 60 秒太短、僅限記憶體、需要客戶端重新呼叫才觸發 |
| `waitForActiveConnection()` | 僅適用 HTTP 模式，stdio 不支援 |
| `activeSessionPromises` | 防重複彈窗，不解決送達問題 |
| busy timeout 回覆 | 指示用戶再次呼叫，但 Cursor 不一定遵循 |

## Proposed Solution

### 核心策略：持久化回應 + 輪詢式交付 + Transport 心跳偵測

```
┌─────────────────────────────────────────────────────────────┐
│                  Feedback Delivery Pipeline                   │
│                                                              │
│  User Submit → DB Persist → Try Transport Push               │
│                     ↓              ↓ (fail)                  │
│               Stored in DB    Mark as undelivered             │
│                     ↓                                        │
│              MCP Client Reconnect / Retry                    │
│                     ↓                                        │
│              Fetch from DB → Return to Client                │
│                     ↓                                        │
│              Client ACK → Mark as delivered                   │
└─────────────────────────────────────────────────────────────┘
```

### 四大改進

#### 1. 回應持久化（Database-backed Response Store）
- 用戶提交回饋後，立即寫入 SQLite（`pending_responses` 表）
- 欄位：`session_id`, `project_id`, `feedback_json`, `created_at`, `delivered`, `delivery_attempts`
- 取代 60 秒記憶體快取，存活時間延長至可配置（預設 24 小時）

#### 2. Transport 健康偵測 + 自動降級
- 為 stdio 模式增加心跳偵測：定期透過 MCP notification 發送 ping，偵測 pipe 是否存活
- 若 Transport 不健康，回應儲存在 DB 等待重連
- 統一 stdio/HTTP 的連線狀態偵測介面

#### 3. 客戶端輪詢端點（Polling Fallback）
- 新增 REST API `/api/pending-response/:projectId`
- MCP Client 可在 tool call timeout 後主動輪詢
- 回傳最新的未送達回應
- 支援 ACK 確認送達（`POST /api/pending-response/:id/ack`）

#### 4. collect_feedback 的 Timeout 自我復原
- 當 `collect_feedback` 的 Promise 因 transport 斷線而 hang 時
- 設定一個內部看門狗：若 resolve 後未收到 transport 確認，在 N 秒後將回應標記為「待重試」
- 下次 collect_feedback 呼叫時，優先回傳未送達的歷史回應

## Scope

- **In Scope**: 回應持久化、Transport 健康偵測、輪詢 API、ACK 機制
- **Out of Scope**: MCP 協議層變更、前端 UI 改動（Web UI 提交流程不變）

## Impact

- 向後相容：現有 `collect_feedback` 行為不變，但增加可靠性
- 新增 1 張 DB 表：`pending_responses`
- 新增 2 個 API 端點
- 修改 `web-server.ts`、`mcp-server.ts`、`session-storage.ts`、`database.ts`
