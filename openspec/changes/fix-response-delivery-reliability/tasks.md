# fix-response-delivery-reliability — Tasks

## Status: ✅ All tasks completed

## Task List

### T1: 建立 pending_responses DB 表 ✅
- **File**: `src/utils/database.ts`
- **Action**: 新增 `pending_responses` 表的 schema、CRUD 函式（savePendingResponse, getPendingByProject, markDelivered, cleanupExpiredResponses）
- **Verification**: 單元測試驗證 CRUD 操作
- **Dependencies**: 無
- **Parallelizable**: Yes

### T2: 建立 ResponseStore 模組 ✅
- **File**: `src/utils/response-store.ts`（新增）
- **Action**: 封裝 pending_responses 的業務邏輯，提供 save/get/markDelivered/cleanup 方法
- **Verification**: 單元測試
- **Dependencies**: T1
- **Parallelizable**: No

### T3: 改造 handleFeedbackSubmission 流程 ✅
- **File**: `src/server/web-server.ts`
- **Action**: 在 `session.resolve()` 前新增 ResponseStore.save()；根據 transport 健康狀態決定是否立即 resolve；resolve 成功後 markDelivered
- **Verification**: 整合測試 — 模擬 transport 斷線場景
- **Dependencies**: T2
- **Parallelizable**: No

### T4: 改造 collectFeedback 優先檢查未送達回應 ✅
- **File**: `src/server/mcp-server.ts`, `src/server/web-server.ts`
- **Action**: 在 `collectFeedback()` 開頭新增檢查 ResponseStore 是否有未送達回應，有則直接回傳
- **Verification**: 單元測試 — 驗證有 pending response 時直接回傳
- **Dependencies**: T2
- **Parallelizable**: No

### T5: 新增 Transport 健康偵測 ✅
- **File**: `src/server/mcp-server.ts`, `src/server/web-server.ts`
- **Action**: 為 stdio 模式增加心跳偵測（notification ping）；統一 `isTransportHealthy()` 介面覆蓋 stdio/SSE/streamable-http
- **Verification**: 測試 stdio pipe 斷裂偵測
- **Dependencies**: 無
- **Parallelizable**: Yes (可與 T1 並行)

### T6: 新增輪詢 API 端點 ✅
- **File**: `src/server/web-server.ts`
- **Action**: 新增 `GET /api/pending-response/:projectId` 和 `POST /api/pending-response/:responseId/ack` 端點
- **Verification**: API 測試
- **Dependencies**: T2
- **Parallelizable**: Yes (可與 T3/T4 並行)

### T7: 新增定期清理排程 ✅
- **File**: `src/server/web-server.ts`
- **Action**: 在伺服器啟動時設定 interval 定期呼叫 ResponseStore.cleanupExpired()
- **Verification**: 驗證過期記錄被清理
- **Dependencies**: T2
- **Parallelizable**: Yes

### T8: 新增配置項 ✅
- **File**: `src/config/index.ts`
- **Action**: 新增 `MCP_RESPONSE_TTL` 和 `MCP_STDIO_HEARTBEAT_INTERVAL` 環境變數
- **Verification**: 配置測試
- **Dependencies**: 無
- **Parallelizable**: Yes

### T9: 整合測試 + 修改現有測試
- **File**: `src/__tests__/`
- **Action**: 新增 response-store 測試、修改 integration test 涵蓋 recovery 場景
- **Verification**: `npm test` 全部通過
- **Dependencies**: T3, T4, T5, T6
- **Parallelizable**: No

### T10: 構建驗證 + E2E 測試
- **File**: N/A
- **Action**: `npm run build` 編譯成功，`npm test` 通過，手動模擬 Cursor 場景驗證
- **Verification**: 全部通過
- **Dependencies**: T9
- **Parallelizable**: No

## Execution Order

```
T1 ─┬─► T2 ─┬─► T3 ─► T4 ─┬─► T9 ─► T10
T5 ─┘    │   │              │
T8 ─────►│   ├─► T6 ───────┘
         │   └─► T7 ───────┘
```
