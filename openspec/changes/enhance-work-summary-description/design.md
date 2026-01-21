# Design: enhance-work-summary-description

## Overview

本設計文件說明如何改進 `collect_feedback` MCP 工具的描述，讓 AI 在回報時提供詳細的結構化內容。

## Current State

### 現有工具定義

```typescript
// src/server/mcp-server.ts (lines 87-95)
this.mcpServer.registerTool(
  'collect_feedback',
  {
    description: 'Collect feedback from users about AI work summary. This tool opens a web interface for users to provide feedback on the AI\'s work.',
    inputSchema: {
      work_summary: z.string().describe('AI工作匯報內容，描述AI完成的工作和結果'),
      project_name: z.string().optional().describe('專案名稱（用於 Dashboard 分組顯示）'),
      project_path: z.string().optional().describe('專案路徑（用於唯一識別專案）')
    }
  },
  // ...
)
```

### 問題分析

1. **描述過於簡短**：「AI工作匯報內容，描述AI完成的工作和結果」未提供明確的格式指引
2. **缺乏結構要求**：AI 不知道應該包含哪些具體內容
3. **無最小長度提示**：導致 AI 傾向提供簡短回覆

## Proposed Design

### 1. 改進工具描述策略

採用「明確指示 + 範例 + 約束」三層策略：

```
┌─────────────────────────────────────────────────────────────┐
│                    Tool Description                          │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 明確指示                                           │
│  - 強調 work_summary 是唯一顯示給用戶的內容                    │
│  - 說明必須包含完整報告                                       │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 結構範例                                           │
│  - 列出必須包含的區段（Task Summary, Details, Status...）     │
│  - 說明每個區段的內容要求                                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 格式約束                                           │
│  - 要求使用 Markdown 格式                                    │
│  - 建議最小字數（500+ 字元）                                  │
└─────────────────────────────────────────────────────────────┘
```

### 2. 新工具定義

```typescript
this.mcpServer.registerTool(
  'collect_feedback',
  {
    description: `Collect feedback from users about AI work. This tool opens a web interface for users to provide feedback.

IMPORTANT: The 'work_summary' field is the PRIMARY and ONLY content displayed to users in the feedback UI. You MUST include ALL relevant information in this field as a comprehensive Markdown-formatted report.

The UI renders Markdown, so use headings, tables, code blocks, and lists for better readability.`,
    inputSchema: {
      work_summary: z.string().describe(`【CRITICAL - THIS IS THE ONLY CONTENT SHOWN TO USERS】

Include a COMPLETE Markdown report with ALL of the following sections:

## Required Sections:
1. **📋 Task Summary** - Brief description of what was requested and accomplished
2. **📁 Implementation Details** - Files created/modified with:
   - Full file paths
   - Key code snippets in code blocks
   - Explanation of changes
3. **✅ Status Table** - Markdown table showing completion status:
   | Item | Status | Notes |
   |------|--------|-------|
   | Feature A | ✅ Done | ... |
4. **🧪 Test Results** - Build/test command outputs and outcomes
5. **➡️ Next Steps** - Actionable options in A/B/C format for user decision:
   - Option A: [action] - [description]
   - Option B: [action] - [description]
6. **🏗️ Architecture** (if applicable) - ASCII diagrams or Mermaid code blocks

## Format Requirements:
- Use Markdown: ## headings, \`code\`, **bold**, tables
- Minimum 500 characters for non-trivial tasks
- Be specific with file paths and code examples
- Include ALL information user needs to make decisions`),
      project_name: z.string().optional().describe('專案名稱（用於 Dashboard 分組顯示）'),
      project_path: z.string().optional().describe('專案路徑（用於唯一識別專案）')
    }
  },
  // handler unchanged
)
```

### 3. 類型定義更新（可選）

```typescript
// src/types/index.ts
export interface CollectFeedbackParams {
  work_summary: string;
  project_name?: string;
  project_path?: string;
}
```

類型定義不需變更，因為欄位簽章不變。

### 4. 前端 Markdown 渲染確認

確認 `index.html` 已載入 `marked.js` 並正確渲染 Markdown：

```javascript
// 現有: src/static/modules/socket-manager.js
displayAIMessage(data.work_summary);

// displayAIMessage 函式應使用 marked.parse() 渲染 Markdown
```

需確認 `displayAIMessage` 函式正確處理 Markdown。

## Implementation Approach

### Phase 1: 核心描述更新
1. 修改 `src/server/mcp-server.ts` 中的工具描述
2. 更新 `work_summary` 的 `.describe()` 內容

### Phase 2: 前端驗證
1. 確認 Markdown 渲染正常
2. 測試長報告的顯示效果

### Phase 3: 測試更新
1. 更新 `integration.test.ts` 中的測試案例
2. 確認工具描述變更不影響功能

## Alternatives Considered

### Alternative A: 新增獨立的 detailed_report 欄位

**優點**: 向後相容，不影響現有行為
**缺點**: 
- 需要修改資料庫結構
- 需要更新前端顯示邏輯
- 複雜度增加

**決定**: 不採用，因為描述改進已足夠且影響最小

### Alternative B: 使用 JSON Schema 強制結構

**優點**: 強制執行格式
**缺點**:
- AI 可能難以遵循嚴格的 JSON 結構
- 失去 Markdown 的可讀性
- 需要前端解析 JSON

**決定**: 不採用，自由形式的 Markdown 更靈活

## Backward Compatibility

- ✅ 不變更欄位名稱或類型
- ✅ 不變更 API 端點
- ✅ 不變更資料庫結構
- ✅ 現有工作流程不受影響
