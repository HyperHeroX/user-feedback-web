# Design: MCP AI Integration

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (app.js)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ generateAI  │───▶│ parseTool   │───▶│ executeMCPTools │  │
│  │ReplyWithTools│   │  Calls()    │    │      ()         │  │
│  └──────┬──────┘    └─────────────┘    └────────┬────────┘  │
│         │                                       │           │
│         │         ┌─────────────────┐           │           │
│         │         │ Progress UI     │◀──────────┤           │
│         │         │ (輪數/工具狀態)  │           │           │
│         │         └─────────────────┘           │           │
│         ▼                                       ▼           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   API Calls                              ││
│  │  POST /api/ai-reply       POST /api/mcp/execute-tools   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend (Express)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────┐ │
│  │  ai-service  │◀───│ web-server   │───▶│ mcp-client-mgr │ │
│  │              │    │  (routes)    │    │                │ │
│  └──────────────┘    └──────────────┘    └────────────────┘ │
│         │                                       │           │
│         ▼                                       ▼           │
│  ┌──────────────┐                       ┌────────────────┐  │
│  │   OpenAI /   │                       │  MCP Servers   │  │
│  │   Deepseek   │                       │  (external)    │  │
│  └──────────────┘                       └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Sequence Diagram (Multi-Round Execution)

```
User              Frontend            Backend           AI API        MCP Server
  │                  │                   │                │               │
  │ Click AI Reply   │                   │                │               │
  │─────────────────▶│                   │                │               │
  │                  │                   │                │               │
  │                  │ ══════════════════════════════════════════════════ │
  │                  │        Round 1 (includeMCPTools=true)              │
  │                  │ ══════════════════════════════════════════════════ │
  │                  │                   │                │               │
  │                  │ GET /api/mcp/tools│                │               │
  │                  │──────────────────▶│                │               │
  │                  │◀──────────────────│ [tools list]  │               │
  │                  │                   │                │               │
  │                  │ POST /api/ai-reply│                │               │
  │                  │ {includeMCPTools: │                │               │
  │                  │  true}            │                │               │
  │                  │──────────────────▶│                │               │
  │                  │                   │  prompt +      │               │
  │                  │                   │  tool desc     │               │
  │                  │                   │───────────────▶│               │
  │                  │                   │◀───────────────│               │
  │                  │◀──────────────────│  JSON with     │               │
  │                  │                   │  tool_calls    │               │
  │                  │                   │                │               │
  │  Update Progress │                   │                │               │
  │◀─────────────────│                   │                │               │
  │  "Round 1/5"     │                   │                │               │
  │                  │                   │                │               │
  │                  │ Parse tool_calls  │                │               │
  │                  │ from JSON         │                │               │
  │                  │                   │                │               │
  │                  │ POST /api/mcp/    │                │               │
  │                  │ execute-tools     │                │               │
  │                  │──────────────────▶│                │               │
  │                  │                   │────────────────┼──────────────▶│
  │                  │                   │◀───────────────┼───────────────│
  │                  │◀──────────────────│ tool results  │               │
  │                  │                   │                │               │
  │                  │ ══════════════════════════════════════════════════ │
  │                  │        Round 2-4 (includeMCPTools=false)           │
  │                  │ ══════════════════════════════════════════════════ │
  │                  │                   │                │               │
  │  Update Progress │                   │                │               │
  │◀─────────────────│ POST /api/ai-reply│                │               │
  │  "Round N/5"     │ {toolResults}     │                │               │
  │                  │──────────────────▶│                │               │
  │                  │                   │  prompt +      │               │
  │                  │                   │  results       │               │
  │                  │                   │───────────────▶│               │
  │                  │                   │◀───────────────│               │
  │                  │◀──────────────────│ next response │               │
  │                  │                   │                │               │
  │                  │ (repeat until no  │                │               │
  │                  │  tool_calls or    │                │               │
  │                  │  round 5)         │                │               │
  │                  │                   │                │               │
  │                  │ ══════════════════════════════════════════════════ │
  │                  │        Round 5 (User Confirmation Required)        │
  │                  │ ══════════════════════════════════════════════════ │
  │                  │                   │                │               │
  │ Confirm Dialog   │                   │                │               │
  │◀─────────────────│                   │                │               │
  │ "Continue?"      │                   │                │               │
  │─────────────────▶│                   │                │               │
  │ Yes/No           │                   │                │               │
  │                  │                   │                │               │
  │◀─────────────────│                   │                │               │
  │ Final result     │                   │                │               │
```

## Component Details

### 1. Tool Call Parser (`src/utils/mcp-tool-parser.ts`)

```typescript
// 工具呼叫 JSON 格式
interface ToolCallsResponse {
  tool_calls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  message?: string;
}

interface ParseResult {
  toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
  message: string;
}

export function parseToolCalls(response: string): ParseResult {
  // 嘗試解析完整 JSON
  // 如果失敗，嘗試從 markdown code block 中提取
  // 如果仍失敗，返回空陣列
}
```

### 2. AI Service Extension (`src/utils/ai-service.ts`)

```typescript
interface AIReplyRequest {
  aiMessage: string;
  userContext?: string;
  includeMCPTools?: boolean;  // 是否注入工具描述
  toolResults?: Array<{       // 上一輪工具執行結果
    name: string;
    success: boolean;
    content?: string;
    error?: string;
  }>;
}

// 修改 buildPrompt 支援工具描述注入
function buildPrompt(
  systemPrompt: string,
  aiMessage: string,
  userContext?: string,
  mcpTools?: MCPToolInfo[],
  toolResults?: ToolResult[]
): string;
```

### 3. Frontend State Machine

```
                    ┌─────────────┐
                    │    IDLE     │
                    └──────┬──────┘
                           │ generateAIReplyWithTools()
                           ▼
                    ┌─────────────┐
                    │   ROUND 1   │ ◀──────┐
                    │  (with      │        │
                    │   tools)    │        │
                    └──────┬──────┘        │
                           │               │
              ┌────────────┴────────────┐  │
              │                         │  │
              ▼                         ▼  │
       (no tool_calls)          (has tool_calls)
              │                         │  │
              │                  ┌──────┴──┤
              │                  │EXECUTING│
              │                  │  TOOLS  │
              │                  └────┬────┘
              │                       │
              │                  ┌────┴────┐
              │                  │ ROUND   │
              │                  │ 2-4     │────┐
              │                  └────┬────┘    │
              │                       │         │ (has tool_calls)
              │                       │         │
              │              (no tool_calls)    │
              │                       │         │
              │                  ┌────┴────┐    │
              │                  │ ROUND 5 │◀───┘
              │                  │ CONFIRM │
              │                  └────┬────┘
              │                       │
              │              ┌────────┴────────┐
              │              │                 │
              │         (continue)         (stop)
              │              │                 │
              ▼              ▼                 ▼
        ┌─────────────────────────────────────────┐
        │              COMPLETE                   │
        └─────────────────────────────────────────┘
```

## API Specifications

### GET /api/mcp/tools (existing)
Returns list of available MCP tools from all connected servers.

### POST /api/ai-reply (modified)

**Request:**
```typescript
{
  aiMessage: string;
  userContext?: string;
  includeMCPTools?: boolean;  // default: false
  toolResults?: Array<{
    name: string;
    success: boolean;
    content?: string;
    error?: string;
  }>;
}
```

**Response:**
```typescript
{
  success: boolean;
  reply?: string;  // 可能包含 tool_calls JSON
  error?: string;
}
```

### POST /api/mcp/execute-tool (new)

**Request:**
```typescript
{
  toolName: string;
  arguments: Record<string, unknown>;
}
```

**Response:**
```typescript
{
  success: boolean;
  content?: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  error?: string;
}
```

### POST /api/mcp/execute-tools (new - batch)

**Request:**
```typescript
{
  calls: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}
```

**Response:**
```typescript
{
  results: Array<{
    name: string;
    success: boolean;
    content?: MCPContent[];
    error?: string;
  }>;
}
```

## UI Components

### Progress Indicator

```html
<div id="tool-execution-progress" class="tool-progress hidden">
  <div class="progress-header">
    <span class="round-indicator">執行輪數: <strong>1</strong> / 5</span>
    <span class="status-text">正在執行工具...</span>
  </div>
  <div class="tool-execution-list">
    <!-- 動態生成 -->
    <div class="tool-item executing">
      <span class="tool-name">get_current_time</span>
      <span class="tool-status">⏳ 執行中...</span>
    </div>
    <div class="tool-item success">
      <span class="tool-name">search_files</span>
      <span class="tool-status">✅ 完成</span>
    </div>
    <div class="tool-item error">
      <span class="tool-name">read_file</span>
      <span class="tool-status">❌ 失敗</span>
    </div>
  </div>
</div>
```

### Confirmation Dialog (Round 5)

```html
<div id="continue-confirm-modal" class="modal hidden">
  <div class="modal-content">
    <h3>⚠️ 已執行 4 輪工具呼叫</h3>
    <p>AI 已執行多輪工具呼叫，是否繼續執行？</p>
    <div class="modal-actions">
      <button onclick="continueExecution()">繼續執行</button>
      <button onclick="stopExecution()">停止</button>
    </div>
  </div>
</div>
```

## Security Considerations

1. **工具執行限制**：單次請求最多執行 10 個工具呼叫
2. **迴圈限制**：最多 5 輪 AI-工具互動，第 5 輪需用戶確認
3. **超時設定**：每個工具呼叫最多 30 秒
4. **輸入驗證**：驗證工具名稱存在於已連接的 MCP Server

## Error Handling

| 錯誤類型 | 處理方式 |
|----------|----------|
| 工具不存在 | 返回錯誤，跳過該工具，繼續其他 |
| JSON 解析錯誤 | 容錯解析，提取可能的有效部分 |
| 執行超時 | 返回超時錯誤，在 UI 顯示 |
| MCP Server 斷線 | 在 UI 顯示警告，標記工具不可用 |

## Configuration

新增環境變數（可選，使用預設值）：

```env
# MCP AI Integration
MCP_TOOL_CALL_TIMEOUT=30000       # 工具呼叫超時（毫秒）
MCP_MAX_TOOL_CALLS_PER_ROUND=10   # 單輪最大工具呼叫數
MCP_MAX_INTERACTION_ROUNDS=5      # 最大互動輪數
```
