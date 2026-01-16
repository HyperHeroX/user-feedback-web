# Proposal: MCP AI Integration

## Overview
讓 user-feedback-web 具備 AI 呼叫 MCP 工具的能力，使其像一個 AI 編輯器一樣可以自動識別並執行 MCP 工具呼叫。

## Problem Statement
目前 user-feedback-web 雖然支援連接 MCP Server 並顯示可用工具，但：
1. AI 回覆時無法自動帶入可用 MCP 工具的描述
2. AI 無法識別並執行工具呼叫
3. 工具執行結果無法回饋給 AI 進行後續處理

## Goals
1. **MCP 工具描述整合**：AI 回覆時自動帶入已連接 MCP Server 的工具描述
2. **工具呼叫識別與執行**：解析 AI 回覆中的工具呼叫指令並執行
3. **結果回饋迴圈**：將工具執行結果傳送給 AI 進行後續處理（最多 5 輪，第 5 輪需用戶確認）
4. **UI 顯示進度**：在前端顯示工具執行進度

## Non-Goals
- 不修改 MCP Server 連接機制（現有架構已完善）
- 不實現多輪對話歷史記錄（超出範圍）

## Proposed Solution

### 1. 工具呼叫格式（遵循 MCP SDK 標準）

根據 [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/client.md)，
工具呼叫使用 `client.callTool()` 方法，格式如下：

```typescript
// MCP SDK 標準格式
const result = await client.callTool({
  name: "tool-name",
  arguments: { arg1: "value1", arg2: "value2" }
});

// 回應格式
{
  content: [
    { type: "text", text: "結果文字" },
    // 或
    { type: "image", data: "base64...", mimeType: "image/png" }
  ],
  isError?: boolean,
  structuredContent?: object
}
```

### 2. AI 工具呼叫格式設計

為讓 AI 能夠呼叫工具，我們定義以下 JSON 格式（易於解析且符合 MCP SDK）：

```json
// AI 回覆中的工具呼叫格式
{
  "tool_calls": [
    {
      "name": "get_current_time",
      "arguments": { "timezone": "Asia/Taipei" }
    },
    {
      "name": "search_files",
      "arguments": { "pattern": "*.ts", "directory": "src" }
    }
  ],
  "message": "讓我幫你查詢一下..."
}
```

### 3. 工具描述注入（Tool Description Injection）

修改 `ai-service.ts` 的 `buildPrompt` 函數，自動注入已連接的 MCP 工具描述：

```typescript
function buildPrompt(
  systemPrompt: string, 
  aiMessage: string, 
  userContext?: string,
  mcpTools?: MCPToolInfo[]
): string {
  let prompt = `${systemPrompt}\n\n`;
  
  // 注入 MCP 工具描述
  if (mcpTools && mcpTools.length > 0) {
    prompt += `## 可用 MCP 工具\n\n`;
    prompt += `你可以使用以下工具來完成任務。要呼叫工具，請在回覆中包含 JSON 格式的 tool_calls：\n\n`;
    
    mcpTools.forEach(tool => {
      prompt += `### ${tool.name}\n`;
      prompt += `描述: ${tool.description}\n`;
      prompt += `參數: ${JSON.stringify(tool.inputSchema, null, 2)}\n\n`;
    });
    
    prompt += `\n呼叫格式範例：\n`;
    prompt += '```json\n';
    prompt += `{
  "tool_calls": [
    { "name": "工具名稱", "arguments": { "參數": "值" } }
  ],
  "message": "說明文字"
}\n`;
    prompt += '```\n\n';
  }
  
  prompt += `## AI 工作匯報\n${aiMessage}\n\n`;
  // ...
}
```

### 4. 執行迴圈（最多 5 輪）

```javascript
async function generateAIReplyWithTools() {
  const MAX_ROUNDS = 5;
  let round = 0;
  let response = null;
  let toolContext = "";
  
  while (round < MAX_ROUNDS) {
    round++;
    
    // 第 5 輪時需要用戶確認
    if (round === 5) {
      const shouldContinue = await showConfirmDialog(
        "AI 已執行 4 輪工具呼叫，是否繼續？"
      );
      if (!shouldContinue) break;
    }
    
    // 更新 UI 顯示進度
    updateProgress(`執行第 ${round} 輪...`);
    
    // 發送請求
    response = await fetch("/api/ai-reply", {
      body: JSON.stringify({
        aiMessage: workSummary,
        userContext: toolContext || userContext,
        includeMCPTools: round === 1  // 只在第一輪注入工具描述
      })
    });
    
    const data = await response.json();
    
    // 嘗試解析工具呼叫
    const toolCalls = parseToolCalls(data.reply);
    
    if (toolCalls.length === 0) {
      // 無工具呼叫，結束迴圈
      return data.reply;
    }
    
    // 執行工具呼叫
    const results = await executeMCPToolCalls(toolCalls);
    
    // 將結果作為下一輪的上下文
    toolContext = formatToolResults(results);
  }
  
  return response;
}
```

## API Changes

### Modified Endpoints

**POST /api/ai-reply**
```typescript
interface AIReplyRequest {
  aiMessage: string;
  userContext?: string;
  includeMCPTools?: boolean;  // 新增：是否注入工具描述
  toolResults?: ToolResult[]; // 新增：上一輪工具執行結果
}
```

### New Endpoints

**POST /api/mcp/execute-tool**
```typescript
// 執行單個 MCP 工具
interface ExecuteToolRequest {
  toolName: string;
  arguments: Record<string, unknown>;
}

interface ExecuteToolResponse {
  success: boolean;
  content?: MCPContent[];
  error?: string;
}
```

**POST /api/mcp/execute-tools**
```typescript
// 批次執行多個 MCP 工具
interface ExecuteToolsRequest {
  calls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

interface ExecuteToolsResponse {
  results: Array<{
    name: string;
    success: boolean;
    content?: MCPContent[];
    error?: string;
  }>;
}
```

## UI Changes

### 進度顯示

新增工具執行進度指示器：

```html
<div id="tool-execution-progress" class="hidden">
  <div class="progress-header">
    <span class="progress-round">執行第 1 輪 / 最多 5 輪</span>
    <span class="progress-status">正在執行工具...</span>
  </div>
  <div class="tool-list">
    <!-- 動態填充工具執行狀態 -->
  </div>
</div>
```

## Testing Strategy

1. **單元測試**：工具呼叫 JSON 解析器
2. **整合測試**：API 端點
3. **瀏覽器 UI 測試**：
   - 連接 time-server MCP
   - 觸發 AI 回覆，確認工具描述已注入
   - 驗證工具呼叫被正確執行
   - 驗證進度 UI 顯示
   - 測試第 5 輪確認對話框

## Risks and Mitigations

| 風險 | 緩解措施 |
|------|----------|
| AI 生成無效 JSON | 使用容錯解析，嘗試提取有效部分 |
| 工具執行失敗 | 捕獲錯誤並在 UI 顯示 |
| 無限迴圈 | 限制最大 5 輪，第 5 輪需用戶確認 |
| 工具執行超時 | 設定 30 秒超時 |

## Timeline

| 任務 | 預估時間 |
|------|----------|
| T1: 工具呼叫解析器 | 0.5h |
| T2: ai-service 修改 | 1h |
| T3: execute-tool API | 0.5h |
| T4: execute-tools API | 0.5h |
| T5: ai-reply API 修改 | 0.5h |
| T6: 前端執行迴圈 | 1.5h |
| T7: 進度 UI 組件 | 1h |
| T8: 瀏覽器 UI 測試 | 1h |
| T9: 文檔更新 | 0.5h |

**總計**：約 7 小時
