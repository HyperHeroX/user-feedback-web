# Proposal: enhance-work-summary-description

## Status

**Draft** | Created: 2026-01-22

## Problem Statement

目前 AI 透過 `collect_feedback` MCP 工具回應時，只會提供簡短的內容。經調查發現：

1. **工具描述不明確**：`work_summary` 欄位的描述僅為「AI工作匯報內容，描述AI完成的工作和結果」，未明確指示 AI 應提供詳細的結構化報告
2. **UI 只顯示 work_summary**：MCP 工具的 UI 介面只顯示 `work_summary` 欄位內容，而非完整的訊息
3. **AI 行為不一致**：不同 AI 模型對簡短描述的理解不同，導致回報內容品質參差不齊

## Why

用戶需要 AI 提供完整的工作報告，包含：
- 實作內容詳情（檔案位置、程式碼片段）
- 完成狀態表格
- 測試結果
- 下一步建議選項
- 架構圖或流程說明

目前的簡短描述無法滿足這些需求，導致用戶難以做出正確的決策或理解 AI 完成的工作。

## What Changes

### 1. 改進 MCP 工具描述

更新 `collect_feedback` 工具的 `description` 和 `work_summary` 欄位的 `.describe()` 內容：

**工具主描述（description）**:
```
Collect feedback from users about AI work. The work_summary field is the PRIMARY and ONLY content shown to users in the UI. You MUST include ALL relevant information in work_summary as a comprehensive Markdown report.
```

**work_summary 欄位描述**:
```
【CRITICAL】This is the ONLY content displayed to users. Include a COMPLETE Markdown report with:
1. **Task Summary** - What was requested and accomplished
2. **Implementation Details** - Files created/modified with paths and key code snippets
3. **Status Table** - Completion status of each item (✅/❌/⏳)
4. **Test Results** - Build/test outcomes
5. **Next Steps** - Actionable options (A/B/C format) for user decision
6. **Architecture/Flow** (if applicable) - Diagrams using code blocks

Format: Use Markdown headings (##), tables, code blocks, and bullet points for clarity.
Minimum length: 500+ characters for any non-trivial task.
```

### 2. 新增工具輸入參數（可選）

新增 `report_type` 可選參數，讓 AI 可以指定報告類型：

```typescript
report_type: z.enum(['summary', 'detailed', 'decision']).optional()
  .describe('報告類型：summary(簡要)、detailed(詳細，預設)、decision(需決策)')
```

### 3. 前端 UI 增強

- 改進 `aiMessageDisplay` 區域的 Markdown 渲染支援
- 支援摺疊式區塊（`<details>`）顯示長報告
- 支援狀態表格樣式優化

## Scope

**In scope:**
- MCP 工具描述文字更新
- work_summary 欄位描述強化
- 可選的 report_type 參數
- 前端 Markdown 渲染增強

**Out of scope:**
- 新的 AI 服務整合
- 工具行為邏輯變更
- 資料庫結構變更

## Impact Analysis

| 元件 | 影響 | 說明 |
|------|------|------|
| `mcp-server.ts` | 修改 | 更新工具描述和參數 |
| `index.ts` (types) | 可選修改 | 新增 report_type 類型 |
| `index.html` | 修改 | 改進 Markdown 渲染 |
| `style.css` | 修改 | 狀態表格樣式 |
| 測試檔案 | 修改 | 更新測試案例 |

## Risks

1. **向後相容性** - 現有 AI 工作流不受影響，描述變更僅影響新的工具呼叫
2. **AI 行為依賴** - 描述改進後，AI 是否遵循仍取決於模型能力

## Success Criteria

1. AI 透過 `collect_feedback` 工具提交的 `work_summary` 平均長度增加 3 倍以上
2. 報告包含結構化的 Markdown 格式（標題、表格、程式碼區塊）
3. 用戶能在 UI 中清楚閱讀完整報告內容

## References

- 現有實作: [mcp-server.ts](src/server/mcp-server.ts#L85-L180)
- 類型定義: [types/index.ts](src/types/index.ts#L70)
- 前端顯示: [static/index.html](src/static/index.html)
