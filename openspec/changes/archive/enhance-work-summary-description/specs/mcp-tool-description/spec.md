# Spec: MCP Tool Description Enhancement

## Capability

`collect_feedback` MCP 工具描述增強，引導 AI 提供詳細的結構化報告。

---

## MODIFIED Requirements

### Requirement: MCP-TOOL-001 - collect_feedback Tool Description

工具描述必須明確說明 `work_summary` 是唯一顯示給用戶的內容，並要求 AI 提供完整的 Markdown 格式報告。

#### Scenario: AI 呼叫 collect_feedback 工具時接收明確的格式指引

**Given** AI 查詢可用的 MCP 工具  
**When** AI 讀取 `collect_feedback` 工具的描述  
**Then** 描述應包含以下關鍵資訊：
- `work_summary` 是唯一顯示給用戶的內容
- 報告應使用 Markdown 格式
- 報告應包含結構化區段（Task Summary, Implementation Details, Status, Test Results, Next Steps）

#### Scenario: work_summary 欄位描述包含詳細的格式要求

**Given** AI 讀取 `work_summary` 欄位的 `.describe()` 內容  
**When** AI 準備填寫 `work_summary` 值  
**Then** 描述應包含：
- 必要的報告區段列表
- 每個區段的內容要求
- Markdown 格式範例
- 建議的最小長度（500+ 字元）

---

### Requirement: MCP-TOOL-002 - Tool Description Content

工具主描述（`description` 欄位）必須清楚傳達工具用途和報告要求。

#### Scenario: 工具描述包含關鍵提示

**Given** `collect_feedback` 工具的 `description` 欄位  
**When** AI 解析工具定義  
**Then** 描述應包含：
- "work_summary field is the PRIMARY and ONLY content displayed to users"
- "comprehensive Markdown-formatted report"
- "UI renders Markdown"

---

### Requirement: MCP-TOOL-003 - work_summary Field Description

`work_summary` 欄位的 `.describe()` 必須提供完整的格式指引。

#### Scenario: 欄位描述列出所有必要區段

**Given** `work_summary` 欄位的描述內容  
**When** AI 閱讀欄位描述  
**Then** 應包含以下區段要求：
1. Task Summary - 任務摘要
2. Implementation Details - 實作詳情（含檔案路徑、程式碼片段）
3. Status Table - 狀態表格（含完成狀態符號）
4. Test Results - 測試結果
5. Next Steps - 下一步選項（A/B/C 格式）
6. Architecture（可選）- 架構圖

#### Scenario: 欄位描述指定格式要求

**Given** `work_summary` 欄位的描述內容  
**When** AI 閱讀格式要求  
**Then** 應包含：
- 使用 Markdown 格式
- 使用標題、表格、程式碼區塊
- 建議最小 500 字元

---

## ADDED Requirements

### Requirement: MCP-TOOL-004 - Description Language Consistency

工具描述應使用英文，以確保跨語言 AI 模型的一致理解。

#### Scenario: 主描述使用英文

**Given** `collect_feedback` 工具的 `description` 欄位  
**Then** 內容應為英文

#### Scenario: work_summary 欄位描述使用英文

**Given** `work_summary` 欄位的 `.describe()` 內容  
**Then** 主要指引應為英文（區段名稱可保留雙語）

---

## Validation Criteria

| 要求 | 驗證方式 |
|------|---------|
| MCP-TOOL-001 | 檢查 `mcp-server.ts` 中的描述內容 |
| MCP-TOOL-002 | 檢查 `description` 欄位包含關鍵字 |
| MCP-TOOL-003 | 檢查 `.describe()` 包含所有必要區段 |
| MCP-TOOL-004 | 檢查描述使用英文 |

---

## Implementation Notes

### 目標檔案
- `src/server/mcp-server.ts` (lines 87-95)

### 關鍵變更
```typescript
// Before
description: 'Collect feedback from users about AI work summary...'
work_summary: z.string().describe('AI工作匯報內容，描述AI完成的工作和結果')

// After
description: 'Collect feedback from users about AI work. IMPORTANT: The work_summary field is the PRIMARY and ONLY content displayed...'
work_summary: z.string().describe('【CRITICAL - THIS IS THE ONLY CONTENT SHOWN TO USERS】\n\nInclude a COMPLETE Markdown report...')
```

### 向後相容性
- ✅ 不變更 API 簽章
- ✅ 不變更資料結構
- ✅ 現有功能不受影響
