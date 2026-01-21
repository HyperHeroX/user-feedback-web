# Tasks: enhance-work-summary-description

## Overview

實施 `collect_feedback` MCP 工具描述增強，讓 AI 提供詳細的結構化報告。

## Prerequisites

- [x] 確認現有工具定義位置
- [x] 確認前端 Markdown 渲染機制

---

## Task List

### Phase 1: 核心描述更新

#### Task 1.1: 更新 MCP 工具主描述
- **檔案**: `src/server/mcp-server.ts`
- **行數**: ~90
- **動作**: 更新 `description` 欄位
- **驗證**: 工具描述包含明確的報告要求說明

#### Task 1.2: 更新 work_summary 欄位描述
- **檔案**: `src/server/mcp-server.ts`
- **行數**: ~92
- **動作**: 更新 `z.string().describe()` 內容
- **驗證**: 描述包含完整的報告格式指引

---

### Phase 2: 前端驗證

#### Task 2.1: 確認 Markdown 渲染函式
- **檔案**: `src/static/app.js` 或 `src/static/modules/feedback-handler.js`
- **動作**: 確認 `displayAIMessage` 函式使用 `marked.parse()` 渲染
- **驗證**: 長 Markdown 報告正確顯示

#### Task 2.2: 優化長報告顯示樣式（可選）
- **檔案**: `src/static/style.css`
- **動作**: 
  - 確認表格樣式
  - 確認程式碼區塊樣式
  - 考慮新增 `max-height` 和捲動
- **驗證**: 大量內容不會破壞版面

---

### Phase 3: 測試更新

#### Task 3.1: 更新整合測試
- **檔案**: `src/__tests__/integration.test.ts`
- **動作**: 更新測試案例中的 `work_summary` 範例為較長的結構化內容
- **驗證**: 測試通過

#### Task 3.2: 手動驗證
- **動作**: 
  1. 啟動服務 `pnpm dev`
  2. 使用 AI 呼叫 `collect_feedback` 工具
  3. 確認 AI 回傳詳細報告
- **驗證**: AI 回報內容包含結構化格式

---

### Phase 4: 文件與提交

#### Task 4.1: 更新版本號
- **檔案**: `package.json`
- **動作**: 增加 patch version
- **驗證**: 版本號遞增

#### Task 4.2: 更新 lockfile
- **指令**: `pnpm install --lockfile-only`
- **驗證**: `pnpm-lock.yaml` 已更新

#### Task 4.3: 執行完整測試
- **指令**: `pnpm test`
- **驗證**: 所有測試通過，無異步洩漏警告

#### Task 4.4: 構建驗證
- **指令**: `pnpm build`
- **驗證**: 構建成功無錯誤

#### Task 4.5: Git Commit
- **前提**: 完成所有前置檢查
- **訊息**: `feat(mcp): enhance work_summary description for detailed AI reports`

---

## Completion Criteria

- [ ] Task 1.1 完成
- [ ] Task 1.2 完成
- [ ] Task 2.1 確認
- [ ] Task 2.2 完成（可選）
- [ ] Task 3.1 完成
- [ ] Task 3.2 驗證通過
- [ ] Task 4.1-4.5 完成

## Notes

- 此變更為純描述性更新，不影響工具邏輯
- AI 行為改善程度取決於模型對描述的理解能力
- 建議在多個 AI 模型上測試效果
