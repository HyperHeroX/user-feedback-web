# Tasks: Add Self-Probe (Keep-Alive) Feature

## Phase 1: Configuration & Infrastructure

### T001: Extend Configuration
- **File**: `src/config/index.ts`
- **Action**: 
  - 新增 `enableSelfProbe` 和 `selfProbeIntervalSeconds` 配置項
  - 新增對應環境變數支援
  - 新增配置驗證（間隔範圍 60-600 秒）
- **Verification**: 單元測試驗證配置讀取
- **Dependencies**: None
- **Parallelizable**: Yes

### T002: Database Schema Extension
- **File**: `src/utils/database.ts`
- **Action**: 
  - 新增 `self_probe_settings` 資料表
  - 新增 CRUD 方法
- **Verification**: 單元測試驗證資料存取
- **Dependencies**: None
- **Parallelizable**: Yes (with T001)

## Phase 2: Core Service Implementation

### T003: Create SelfProbeService
- **File**: `src/utils/self-probe-service.ts` (新建)
- **Action**:
  - 實現 `SelfProbeService` 類別
  - 包含 `start()`, `stop()`, `probe()`, `getStats()` 方法
  - 整合 Socket.IO 狀態檢查
  - 整合 MCP Server 狀態檢查
  - 整合 Session 清理觸發
- **Verification**: 單元測試覆蓋所有方法
- **Dependencies**: T001, T002
- **Parallelizable**: No

### T004: Integrate SelfProbeService into WebServer
- **File**: `src/server/web-server.ts`
- **Action**:
  - 在 WebServer 建構時初始化 SelfProbeService
  - 在 `start()` 時根據配置啟動
  - 在 `stop()` 時正確停止
  - 暴露 getter 方法供 API 使用
- **Verification**: 整合測試驗證生命週期
- **Dependencies**: T003
- **Parallelizable**: No

## Phase 3: API Endpoints

### T005: Add Self-Probe Settings API
- **File**: `src/server/web-server.ts`
- **Action**:
  - 新增 `GET /api/settings/self-probe` 端點
  - 新增 `POST /api/settings/self-probe` 端點
  - 實現即時套用設定變更
- **Verification**: API 測試驗證請求/回應
- **Dependencies**: T003, T004
- **Parallelizable**: No

### T006: Extend Health API
- **File**: `src/server/web-server.ts`
- **Action**:
  - 在 `/api/health` 端點新增 Self-Probe 狀態資訊
  - 包含最後探查時間、探查次數等
- **Verification**: API 測試
- **Dependencies**: T004
- **Parallelizable**: Yes (with T005)

## Phase 4: Settings UI

### T007: Add Self-Probe Section to Settings Page
- **Files**: 
  - `src/static/settings.html`
  - `src/static/settings.js`
- **Action**:
  - 新增「自我探查」設定區塊
  - 實現開關控制和間隔輸入
  - 實現儲存功能
  - 實現載入現有設定
- **Verification**: 手動測試 UI 互動
- **Dependencies**: T005
- **Parallelizable**: No

### T008: Add Status Indicator (Optional Enhancement)
- **File**: `src/static/dashboard.html`, `src/static/dashboard.js`
- **Action**:
  - 在 Dashboard 顯示 Self-Probe 狀態指示器
  - 顯示最後探查時間
- **Verification**: 手動測試
- **Dependencies**: T006
- **Parallelizable**: Yes (with T007)

## Phase 5: System Stability Enhancements

### T009: Audit process.exit Calls
- **Files**: `src/cli.ts`, `src/server/web-server.ts`
- **Action**:
  - 審查所有 `process.exit()` 調用
  - 確保關鍵退出點有適當的清理邏輯
  - 在可能的情況下使用優雅關閉
- **Verification**: 程式碼審查 + 手動測試
- **Dependencies**: None
- **Parallelizable**: Yes

### T010: Enhance Timer Management
- **Files**: Various
- **Action**:
  - 確保所有 `setInterval`/`setTimeout` 都有對應的 clear
  - 在服務停止時清理所有計時器
  - 考慮使用統一的 TimerManager
- **Verification**: 測試服務停止時無計時器洩漏
- **Dependencies**: None
- **Parallelizable**: Yes (with T009)

### T011: Review Error Handling
- **Files**: `src/server/mcp-server.ts`, `src/utils/mcp-client-manager.ts`
- **Action**:
  - 審查 transport 錯誤處理
  - 確保重連邏輯健壯
  - 增強錯誤日誌以便診斷
- **Verification**: 模擬錯誤場景測試
- **Dependencies**: None
- **Parallelizable**: Yes (with T009, T010)

## Phase 6: Testing & Documentation

### T012: Add Unit Tests for SelfProbeService
- **File**: `src/__tests__/self-probe-service.test.ts` (新建)
- **Action**:
  - 測試啟動/停止邏輯
  - 測試探查執行
  - 測試配置變更
  - 測試異常處理
- **Verification**: Jest 測試通過
- **Dependencies**: T003
- **Parallelizable**: Yes (after T003)

### T013: Add Integration Tests
- **File**: `src/__tests__/integration.test.ts`
- **Action**:
  - 新增 Self-Probe 整合測試
  - 測試設定 API
  - 測試服務生命週期
- **Verification**: Jest 測試通過
- **Dependencies**: T005
- **Parallelizable**: Yes (after T005)

### T014: Update Documentation
- **Files**: `README.md`, `.docs/CONFIGURATION.md`
- **Action**:
  - 記錄新增的環境變數
  - 記錄 Self-Probe 功能使用方式
  - 更新設定說明
- **Verification**: 文件審查
- **Dependencies**: T007
- **Parallelizable**: Yes (after T007)

## Task Dependency Graph

```
T001 ──┬──► T003 ──► T004 ──┬──► T005 ──► T007 ──► T014
       │                    │
T002 ──┘                    └──► T006 ──► T008 (optional)
                                   │
                                   └──► T012
                                   
T009 ─┬─► (independent stability work)
T010 ─┤
T011 ─┘

T003 ──► T012
T005 ──► T013
```

## Estimated Effort

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | T001, T002 | Small |
| Phase 2 | T003, T004 | Medium |
| Phase 3 | T005, T006 | Small |
| Phase 4 | T007, T008 | Medium |
| Phase 5 | T009-T011 | Medium |
| Phase 6 | T012-T014 | Small |

## Acceptance Criteria

- [x] Self-Probe 可在設定頁面開關
- [x] 設定變更即時生效
- [x] 服務閒置 10+ 分鐘後仍保持響應
- [x] 所有單元測試通過 (17 個測試)
- [x] 無計時器洩漏 - SelfProbeService 有正確的 stop() 清理
- [ ] 文件已更新 (可選)

## Implementation Status

All core tasks completed:
- T001-T007: Core feature implementation ✅
- T009-T011: Stability review ✅
- T012-T013: Testing ✅
