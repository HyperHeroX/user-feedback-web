# Tasks: add-ai-conversation-ui

## Overview

實作改進的 AI 對話視窗 UI，使用工廠模式選擇 API/CLI 模式。

---

## Phase 1: 後端工廠模式重構

### T1: 建立 AI Provider 介面和工廠類別

**File:** `src/utils/ai-provider-factory.ts` (新增)

- [ ] 定義 `IAIProvider` 介面
  - `generateReply(request: AIReplyRequest): Promise<AIReplyResponse>`
  - `getName(): string`
  - `getMode(): 'api' | 'cli'`
- [ ] 實作 `APIProvider` 類別（封裝現有 `generateAPIReply`）
- [ ] 實作 `CLIProvider` 類別（封裝現有 `generateCLIReply`）
- [ ] 實作 `AIProviderFactory.getProvider(settings)` 方法

**Acceptance:**
- `npm run build` 成功
- 單元測試覆蓋工廠選擇邏輯

### T2: 重構 ai-service.ts 使用工廠模式

**File:** `src/utils/ai-service.ts`

- [ ] 匯入 `AIProviderFactory`
- [ ] 修改 `generateAIReply()` 使用工廠模式
- [ ] 保留向後相容性

**Acceptance:**
- 現有功能不受影響
- `npm test` 通過

---

## Phase 2: 前端對話視窗 UI 重構

### T3: 建立對話條目元件函式

**File:** `src/static/modules/feedback-handler.js`

- [ ] 新增 `createConversationEntry(type, content, options)` 函式
- [ ] 支援類型: `prompt`, `thinking`, `tool`, `result`, `ai`, `error`
- [ ] 每個條目包含: 圖示、標題、模式標籤、時間戳、可展開內容
- [ ] 使用 `<details>` 元素實現展開/收合

**Acceptance:**
- 各類型條目正確渲染
- 展開/收合功能正常

### T4: 更新對話視窗樣式

**File:** `src/static/style.css`

- [ ] 新增 `.conversation-entry` 樣式
- [ ] 定義各類型的顏色主題（使用 CSS 變數）
- [ ] 響應式設計支援
- [ ] 平滑過渡動畫

**Acceptance:**
- 視覺呈現與設計稿一致
- 深色/淺色模式支援

### T5: 重構 generateAIReply 前端流程

**File:** `src/static/modules/feedback-handler.js`

- [ ] 修改 `generateAIReply()` 使用新的對話條目元件
- [ ] 顯示當前使用的模式 (API/CLI)
- [ ] 保留現有的進度追蹤功能

**Acceptance:**
- 手動 AI 回覆顯示新 UI
- 進度和結果正確顯示

### T6: 重構 generateAIReplyWithTools 前端流程

**File:** `src/static/modules/feedback-handler.js`

- [ ] 修改 `generateAIReplyWithTools()` 使用新的對話條目元件
- [ ] 工具呼叫和結果使用對應的條目類型
- [ ] 多輪對話支援 Round 標籤

**Acceptance:**
- MCP 工具呼叫流程顯示新 UI
- 多輪對話清晰呈現

### T7: 更新自動 AI 回覆流程

**File:** `src/static/modules/timer-controller.js`, `src/static/modules/feedback-handler.js`

- [ ] 確保 `triggerAutoAIReply` 使用新 UI
- [ ] 自動回覆時顯示相同的對話視窗

**Acceptance:**
- 自動 AI 回覆與手動回覆 UI 一致

---

## Phase 3: 整合與測試

### T8: 更新 index.html 對話視窗結構

**File:** `src/static/index.html`

- [ ] 更新 `aiStreamingPanel` 結構（如需要）
- [ ] 確保新的 CSS 類別正確應用

**Acceptance:**
- HTML 結構支援新的對話條目

### T9: 單元測試

**File:** `src/__tests__/ai-provider-factory.test.ts` (新增)

- [ ] 測試 `AIProviderFactory.getProvider()` 選擇邏輯
- [ ] 測試 `APIProvider` 基本功能
- [ ] 測試 `CLIProvider` 基本功能
- [ ] 測試 fallback 邏輯

**Acceptance:**
- 測試覆蓋率 > 80%
- `npm test` 全部通過

### T10: E2E 瀏覽器測試

- [ ] 測試手動 AI 回覆完整流程
- [ ] 測試自動 AI 回覆完整流程
- [ ] 測試 API 模式顯示
- [ ] 測試 CLI 模式顯示（如有安裝 CLI 工具）

**Acceptance:**
- 使用 Browser Automation Tools 測試通過

---

## Phase 4: 文件與清理

### T11: 更新相關文件

- [ ] 更新 `README.md` 說明新的 AI 回覆 UI
- [ ] 確保程式碼註解完整

**Acceptance:**
- 文件準確反映新功能

### T12: 最終驗證與提交

- [ ] `npm run build` 成功
- [ ] `npm test` 全部通過
- [ ] E2E 測試通過
- [ ] 程式碼風格一致

**Acceptance:**
- 所有 pre-commit 檢查通過
- PR 準備就緒

---

## Task Dependencies

```
T1 ──▶ T2 ──┐
            │
T3 ──▶ T5 ──┼──▶ T9 ──▶ T10 ──▶ T12
  │         │
  ▼         │
T4 ──▶ T6 ──┤
            │
T7 ────────┘
            │
T8 ─────────┘
            │
T11 ────────┘
```

## Estimated Effort

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Phase 1 | T1-T2 | 2-3 hours |
| Phase 2 | T3-T7 | 4-5 hours |
| Phase 3 | T8-T10 | 2-3 hours |
| Phase 4 | T11-T12 | 1 hour |
| **Total** | | **9-12 hours** |
