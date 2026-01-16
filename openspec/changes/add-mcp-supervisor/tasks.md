# Implementation Tasks: MCP Supervisor

## Phase 1: Infrastructure (Foundation)

### T001: Create Shared IPC Types and Constants

- **Files**: 
  - `src/shared/ipc-types.ts` (新增)
  - `src/shared/ipc-constants.ts` (新增)
- **Action**: 
  - 定義 IPC 消息接口 (IPCMessage, IPCRequest, IPCResponse, IPCError)
  - 定義消息類型常量
  - 定義狀態枚舉
- **Verification**: TypeScript 編譯通過
- **Dependencies**: 無
- **Parallelizable**: Yes

### T002: Extend Configuration for Supervisor

- **Files**: 
  - `src/config/index.ts` (修改)
  - `src/types/index.ts` (修改)
- **Action**: 
  - 新增 SupervisorConfig 接口
  - 新增環境變數支持 (SUPERVISOR_ENABLED, etc.)
  - 新增配置驗證
- **Verification**: 配置測試通過
- **Dependencies**: T001
- **Parallelizable**: Yes (with T001)

---

## Phase 2: Supervisor Core

### T003: Implement IPC Bridge

- **Files**: 
  - `src/supervisor/ipc-bridge.ts` (新增)
- **Action**: 
  - 實現 IPCBridge 類別
  - 處理 stdio stream 通訊
  - 實現 request/response 匹配
  - 實現超時處理
- **Verification**: 單元測試通過
- **Dependencies**: T001
- **Parallelizable**: No

### T004: Implement Health Monitor

- **Files**: 
  - `src/supervisor/health-monitor.ts` (新增)
- **Action**: 
  - 實現 HealthMonitor 類別
  - 定期發送健康檢查
  - 追蹤健康狀態歷史
  - 發出健康狀態事件
- **Verification**: 單元測試通過
- **Dependencies**: T003
- **Parallelizable**: No

### T005: Implement SupervisorService

- **Files**: 
  - `src/supervisor/supervisor-service.ts` (新增)
- **Action**: 
  - 實現 Worker 生命週期管理 (spawn, kill, restart)
  - 實現自動重啟邏輯
  - 整合 HealthMonitor
  - 整合 IPCBridge
  - 實現請求佇列（Worker 重啟期間）
- **Verification**: 單元測試通過
- **Dependencies**: T003, T004
- **Parallelizable**: No

### T006: Implement MCP Proxy Handler

- **Files**: 
  - `src/supervisor/mcp-proxy.ts` (新增)
- **Action**: 
  - 實現 MCP 請求代理到 Worker
  - 實現 Supervisor 專屬工具:
    - `self_test` (整合健康檢查、自動重啟、診斷資訊)
  - 處理 Worker 不可用時的錯誤回應
- **Verification**: 單元測試通過
- **Dependencies**: T005
- **Parallelizable**: No

### T007: Create Supervisor Entry Point

- **Files**: 
  - `src/supervisor/index.ts` (新增)
- **Action**: 
  - 組合所有 Supervisor 組件
  - 設置 MCP Transport
  - 啟動流程編排
- **Verification**: 可以作為獨立進程啟動
- **Dependencies**: T006
- **Parallelizable**: No

---

## Phase 3: Worker Implementation

### T008: Implement IPC Handler for Worker

- **Files**: 
  - `src/worker/ipc-handler.ts` (新增)
- **Action**: 
  - 實現 Worker 端的 IPC 消息處理
  - 處理健康檢查請求
  - 處理 MCP 工具請求
  - 處理關閉指令
- **Verification**: 單元測試通過
- **Dependencies**: T001
- **Parallelizable**: Yes (with T003-T007)

### T009: Implement WorkerService

- **Files**: 
  - `src/worker/worker-service.ts` (新增)
- **Action**: 
  - 整合現有 WebServer
  - 整合現有 MCPClientManager
  - 整合 SelfProbeService
  - 整合 IPC Handler
  - 實現 'ready' 通知
- **Verification**: 單元測試通過
- **Dependencies**: T008
- **Parallelizable**: No

### T010: Create Worker Entry Point

- **Files**: 
  - `src/worker/index.ts` (新增)
- **Action**: 
  - 初始化 WorkerService
  - 設置 IPC 通訊
  - 處理未捕獲異常（通知 Supervisor）
- **Verification**: 可以作為子進程啟動
- **Dependencies**: T009
- **Parallelizable**: No

---

## Phase 4: CLI & Integration

### T011: Update CLI for Supervisor Mode

- **Files**: 
  - `src/cli.ts` (修改)
- **Action**: 
  - 新增 `--no-supervisor` 選項
  - 根據配置選擇啟動模式
  - 更新幫助訊息
- **Verification**: CLI 幫助訊息正確顯示選項
- **Dependencies**: T007, T010
- **Parallelizable**: No

### T012: Integration Testing

- **Files**: 
  - `src/__tests__/supervisor.integration.test.ts` (新增)
- **Action**: 
  - 測試完整啟動流程
  - 測試 Worker 崩潰恢復
  - 測試 MCP 工具執行
  - 測試優雅關閉
- **Verification**: 整合測試通過
- **Dependencies**: T011
- **Parallelizable**: No

---

## Phase 5: UI Integration (Optional)

### T013: Add Supervisor Status to Settings UI

- **Files**: 
  - `src/static/settings.html` (修改)
  - `src/static/settings.js` (修改)
- **Action**: 
  - 新增 Supervisor 狀態顯示區塊
  - 顯示 Worker 狀態、重啟次數、健康狀態
  - 新增手動重啟 Worker 按鈕
- **Verification**: UI 正確顯示狀態
- **Dependencies**: T012
- **Parallelizable**: No

### T014: Add Supervisor API Endpoints

- **Files**: 
  - `src/server/web-server.ts` (修改)
- **Action**: 
  - 新增 GET /api/supervisor/status
  - 新增 POST /api/supervisor/restart-worker
  - 新增 GET /api/supervisor/diagnostics
- **Verification**: API 測試通過
- **Dependencies**: T012
- **Parallelizable**: Yes (with T013)

---

## Phase 6: Documentation & Cleanup

### T015: Update Documentation

- **Files**: 
  - `README.md` (修改)
  - `docs/SUPERVISOR_GUIDE.md` (新增)
- **Action**: 
  - 記錄 Supervisor 架構
  - 記錄配置選項
  - 記錄故障排除指南
- **Verification**: 文檔完整
- **Dependencies**: T012
- **Parallelizable**: Yes

### T016: Build Configuration Update

- **Files**: 
  - `tsup.config.ts` (修改)
  - `package.json` (修改)
- **Action**: 
  - 更新構建配置以包含新入口點
  - 更新 npm scripts
- **Verification**: 構建成功
- **Dependencies**: T011
- **Parallelizable**: No

---

## Dependency Graph

```
T001 ─────┬─────> T002
          │
          ├─────> T003 ─────> T004 ─────> T005 ─────> T006 ─────> T007 ─┐
          │                                                              │
          └─────> T008 ─────> T009 ─────> T010 ─────────────────────────┤
                                                                         │
                                            ┌────────────────────────────┘
                                            │
                                            ▼
                                         T011 ─────> T012 ─────┬─────> T013
                                                               │
                                                               ├─────> T014
                                                               │
                                                               └─────> T015
                                            │
                                            ▼
                                         T016
```

---

## Acceptance Criteria

- [ ] Supervisor 模式可以成功啟動
- [ ] Worker 崩潰後在 5 秒內自動重啟
- [ ] MCP 工具 `self_test` 可以執行並返回完整診斷資訊
- [ ] `self_test` 在 Worker 失效時自動重啟並回報結果
- [ ] 傳統模式（--no-supervisor）仍然可用
- [ ] 所有現有功能在 Supervisor 模式下正常運作
- [ ] 整合測試全部通過
- [ ] 無計時器洩漏

---

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|-----------------|
| Phase 1 | T001-T002 | 2 |
| Phase 2 | T003-T007 | 8 |
| Phase 3 | T008-T010 | 4 |
| Phase 4 | T011-T012 | 4 |
| Phase 5 | T013-T014 | 3 |
| Phase 6 | T015-T016 | 2 |
| **Total** | **16 tasks** | **~23 hours** |

---

## Implementation Status

| Task | Status | Notes |
|------|--------|-------|
| T001 | ✅ Completed | IPC Types & Constants |
| T002 | ✅ Completed | Config Extension |
| T003 | ✅ Completed | IPC Bridge |
| T004 | ✅ Completed | Health Monitor |
| T005 | ✅ Completed | SupervisorService |
| T006 | ✅ Completed | MCP Proxy Handler |
| T007 | ✅ Completed | Supervisor Entry Point |
| T008 | ✅ Completed | Worker IPC Handler |
| T009 | ✅ Completed | WorkerService |
| T010 | ✅ Completed | Worker Entry Point |
| T011 | ✅ Completed | CLI Integration |
| T012 | ⏸ Pending | Integration Tests |
| T013 | ⏸ Pending | Settings UI |
| T014 | ⏸ Pending | Supervisor API |
| T015 | ⏸ Pending | Documentation |
| T016 | ⏸ Pending | Build Config |
