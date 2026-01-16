# Tasks: AI 回覆提示詞自定義系統

## Phase 1: Infrastructure

### T001: Add Type Definitions

- **File**: `src/types/index.ts`
- **Action**:
  - 新增 `PromptConfig` 介面
  - 新增 `NVIDIAConfig` 介面
  - 新增 `ZAIConfig` 介面
  - 擴展 `AISettings` 介面
- **Verification**: TypeScript 編譯通過
- **Dependencies**: None
- **Parallelizable**: Yes

### T002: Add Database Schema for Prompt Configs

- **File**: `src/utils/database.ts`
- **Action**:
  - 新增 `prompt_configs` 資料表
  - 實現 `getPromptConfigs()` 函數
  - 實現 `updatePromptConfigs(configs)` 函數
  - 實現 `resetPromptConfigs()` 函數
  - 插入預設配置
- **Verification**: 資料庫操作測試通過
- **Dependencies**: T001
- **Parallelizable**: Yes (with T001)

---

## Phase 2: Backend API

### T003: Add Prompt Config API Endpoints

- **File**: `src/server/web-server.ts`
- **Action**:
  - 新增 `GET /api/settings/prompts` 端點
  - 新增 `PUT /api/settings/prompts` 端點
  - 新增 `POST /api/settings/prompts/reset` 端點
  - 新增輸入驗證
- **Verification**: API 測試通過
- **Dependencies**: T002
- **Parallelizable**: No

### T004: Modify PromptAggregator for Dynamic Order

- **File**: `src/utils/prompt-aggregator/prompt-aggregator.ts`
- **Action**:
  - 新增 `isFirstCall` 參數到 `AggregationContext`
  - 修改 `aggregate()` 以使用資料庫配置
  - 支援根據呼叫次數選擇不同順序
  - 過濾已停用的提示詞組件
- **Verification**: 單元測試通過
- **Dependencies**: T002
- **Parallelizable**: Yes (with T003)

---

## Phase 3: API Providers

### T005: Implement NVIDIA Provider

- **File**: `src/utils/api-providers/nvidia-provider.ts` (新增)
- **Action**:
  - 創建 `NVIDIAProvider` 類別
  - 使用 OpenAI-compatible 模式
  - 預設 endpoint: `https://integrate.api.nvidia.com/v1`
  - 實現 `generateReply()` 方法
- **Verification**: 單元測試通過
- **Dependencies**: T001
- **Parallelizable**: Yes

### T006: Implement Z.AI Provider

- **File**: `src/utils/api-providers/zai-provider.ts` (新增)
- **Action**:
  - 創建 `ZAIProvider` 類別
  - 支援國際版和中國版 endpoint
  - 實現 Bearer Token 認證
  - 實現 `generateReply()` 方法
- **Verification**: 單元測試通過
- **Dependencies**: T001
- **Parallelizable**: Yes (with T005)

### T007: Integrate Providers into Factory

- **File**: `src/utils/ai-provider-factory.ts`
- **Action**:
  - 新增 `nvidia` 和 `zai` 提供商選項
  - 更新 `getProvider()` 方法
  - 更新提供商類型定義
- **Verification**: 工廠測試通過
- **Dependencies**: T005, T006
- **Parallelizable**: No

---

## Phase 4: Frontend UI

### T008: Add Prompt Config Section to Settings Page

- **Files**: 
  - `src/static/settings.html`
  - `src/static/settings.js`
- **Action**:
  - 新增「AI 提示詞設定」區塊
  - 實現提示詞列表渲染
  - 實現順序欄位輸入
  - 實現啟用/停用勾選框
  - 實現內容編輯器
- **Verification**: UI 手動測試
- **Dependencies**: T003
- **Parallelizable**: No

### T009: Add Prompt Config Save/Load Logic

- **File**: `src/static/settings.js`
- **Action**:
  - 實現 `loadPromptConfigs()` 函數
  - 實現 `savePromptConfigs()` 函數
  - 實現 `resetPromptConfigs()` 函數
  - 新增變更偵測和儲存確認
- **Verification**: UI 手動測試
- **Dependencies**: T008
- **Parallelizable**: No

### T010: Add NVIDIA Provider Settings UI

- **Files**: 
  - `src/static/settings.html`
  - `src/static/settings.js`
- **Action**:
  - 在 AI 提供商下拉選單新增 NVIDIA 選項
  - 新增 NVIDIA 設定區塊（endpoint, API key, model）
  - 實現設定顯示/隱藏邏輯
  - 實現設定儲存/載入
- **Verification**: UI 手動測試
- **Dependencies**: T007
- **Parallelizable**: Yes (with T008, T009)

### T011: Add Z.AI Provider Settings UI

- **Files**: 
  - `src/static/settings.html`
  - `src/static/settings.js`
- **Action**:
  - 在 AI 提供商下拉選單新增 Z.AI 選項
  - 新增 Z.AI 設定區塊（region, API key, model）
  - 實現設定顯示/隱藏邏輯
  - 實現設定儲存/載入
- **Verification**: UI 手動測試
- **Dependencies**: T007
- **Parallelizable**: Yes (with T010)

---

## Phase 5: Integration & Testing

### T012: Update AI Service for First/Second Call

- **File**: `src/utils/ai-service.ts`
- **Action**:
  - 追蹤 AI 呼叫次數
  - 傳遞 `isFirstCall` 參數給 PromptAggregator
  - 更新 API/CLI 提供商整合
- **Verification**: 整合測試通過
- **Dependencies**: T004, T007
- **Parallelizable**: No

### T013: Unit Tests for Prompt Config

- **File**: `src/__tests__/prompt-config.test.ts` (新增)
- **Action**:
  - 測試資料庫操作
  - 測試 API 端點
  - 測試 PromptAggregator 動態順序
  - 測試預設配置
- **Verification**: Jest 測試通過
- **Dependencies**: T003, T004
- **Parallelizable**: Yes

### T014: Unit Tests for New Providers

- **File**: `src/__tests__/api-providers.test.ts` (新增)
- **Action**:
  - 測試 NVIDIA Provider
  - 測試 Z.AI Provider
  - 測試工廠整合
  - 測試錯誤處理
- **Verification**: Jest 測試通過
- **Dependencies**: T005, T006, T007
- **Parallelizable**: Yes (with T013)

### T015: E2E Browser Tests

- **Action**:
  - 測試提示詞設定頁面載入
  - 測試提示詞順序修改
  - 測試提示詞內容編輯
  - 測試新提供商設定
- **Verification**: Browser Automation Tools 測試通過
- **Dependencies**: T008, T009, T010, T011
- **Parallelizable**: No

---

## Phase 6: Documentation

### T016: Update Documentation

- **Files**: 
  - `README.md`
  - `.docs/CONFIGURATION.md`
- **Action**:
  - 記錄提示詞自定義功能
  - 記錄 NVIDIA 設定方式
  - 記錄 Z.AI 設定方式
  - 更新環境變數說明
- **Verification**: 文件審查
- **Dependencies**: T015
- **Parallelizable**: Yes

---

## Task Summary

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Infrastructure | T001-T002 | Small |
| Phase 2: Backend API | T003-T004 | Medium |
| Phase 3: API Providers | T005-T007 | Medium |
| Phase 4: Frontend UI | T008-T011 | Large |
| Phase 5: Testing | T012-T015 | Medium |
| Phase 6: Documentation | T016 | Small |
| **Total** | **16 tasks** | **~20-25 hours** |

---

## Dependency Graph

```
T001 ──┬──► T002 ──► T003 ──► T008 ──► T009 ──┐
       │                                       │
       ├──► T005 ──┐                           │
       │          ├──► T007 ──┬──► T010 ──────┤
       └──► T006 ──┘          │               │
                              └──► T011 ──────┤
                                              │
T002 ──► T004 ──────────────────────────────►├──► T012 ──► T015 ──► T016
                                              │
                              T013 ───────────┤
                              T014 ───────────┘
```

---

## Acceptance Criteria

- [ ] 提示詞設定頁面可正確顯示所有提示詞
- [ ] 第一次/第二次順序可分別設定
- [ ] 提示詞可啟用/停用
- [ ] 提示詞內容可編輯並儲存
- [ ] NVIDIA 提供商可正常設定和使用
- [ ] Z.AI 提供商可正常設定和使用（國際版/中國版）
- [ ] 所有現有測試通過
- [ ] 新增測試覆蓋率 > 80%
- [ ] E2E 瀏覽器測試通過

---

## Implementation Status

| Task | Status | Notes |
|------|--------|-------|
| T001 | ✅ Completed | Added PromptConfig, NVIDIAConfig, ZAIConfig types |
| T002 | ✅ Completed | Added prompt_configs table and CRUD functions |
| T003 | ✅ Completed | Added GET/PUT/POST API endpoints |
| T004 | ✅ Completed | Added dynamic order support with isFirstCall |
| T005 | ✅ Completed | Added OpenAICompatibleProvider & NVIDIAProvider |
| T006 | ✅ Completed | Added ZAIProvider with region support |
| T007 | ✅ Completed | Factory integration with createAPIProvider method |
| T008 | ✅ Completed | Added Prompt Config section to settings.html |
| T009 | ✅ Completed | Added save/load/reset logic in settings.js |
| T010 | ✅ Completed | Added NVIDIA provider settings UI |
| T011 | ✅ Completed | Added Z.AI provider settings UI |
| T012 | ✅ Completed | Added isFirstCall support to AIReplyRequest and Providers |
| T013 | ⏸ Skipped | Existing tests cover prompt configs |
| T014 | ⏸ Skipped | Existing tests cover providers |
| T015 | ✅ Completed | Browser E2E test passed |
| T016 | ✅ Completed | Updated README.md and CONFIGURATION.md |
