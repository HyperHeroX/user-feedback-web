# Design: Prompt Aggregator Proxy

## Context
目前系統的提示詞構建邏輯分散在多處：
- `ai-service.ts`: `buildPrompt()`, `buildCLIPrompt()`, `getPromptPreview()`
- `api-provider.ts`: `APIProvider.buildPrompt()`
- `cli-provider.ts`: `CLIProvider.buildCLIPrompt()`

這導致：
1. 程式碼重複：相同的提示詞組合邏輯出現在多處
2. 維護困難：修改提示詞格式需要更新多個檔案
3. 不一致風險：預覽和實際使用可能產生不同結果

## Goals / Non-Goals

### Goals
- 建立單一責任的 Prompt Aggregator 類別
- 統一提示詞的組合、預覽和紀錄
- 支援 API 和 CLI 兩種模式的提示詞格式
- 實現可擴展的組件式設計
- CLI 模式支援 MCP 工具呼叫處理

### Non-Goals
- 不改變現有的 Provider 選擇邏輯
- 不修改資料庫架構
- 不改變前端 UI（除非必要）

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AI Provider Factory                           │
│  ┌─────────────────┐                            ┌─────────────────────┐ │
│  │   API Provider  │◄───────────────────────────│   CLI Provider      │ │
│  └────────┬────────┘                            └──────────┬──────────┘ │
│           │                                                │            │
│           └───────────────────┬────────────────────────────┘            │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Prompt Aggregator Proxy                       │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐   │   │
│  │  │ System      │  │  MCP Tools   │  │   Context             │   │   │
│  │  │ Prompt      │  │  Prompt      │  │   Aggregator          │   │   │
│  │  │ Builder     │  │  Builder     │  │   (user, tool results)│   │   │
│  │  └─────────────┘  └──────────────┘  └───────────────────────┘   │   │
│  │                               │                                  │   │
│  │                               ▼                                  │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │              Unified Prompt Output                       │    │   │
│  │  │    - For API: Formatted for API provider                 │    │   │
│  │  │    - For CLI: Formatted for CLI tool input               │    │   │
│  │  │    - For Preview: Same format used by both               │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    CLI MCP Response Handler                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  1. Parse AI Response for MCP Tool Calls                        │   │
│  │  2. Execute MCP Tools if needed                                 │   │
│  │  3. Aggregate MCP Results into new prompt                       │   │
│  │  4. Send back to CLI Terminal                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. IPromptComponent Interface (組件介面)

```typescript
interface IPromptComponent {
  getName(): string;
  getOrder(): number;
  build(context: PromptContext): string | null;
}
```

### 2. PromptContext (提示詞上下文)

```typescript
interface PromptContext {
  request: AIReplyRequest;
  settings: AISettings;
  cliSettings?: CLISettings;
  mode: 'api' | 'cli';
  mcpTools?: Tool[];
}
```

### 3. PromptAggregator Class

```typescript
class PromptAggregator {
  private components: IPromptComponent[] = [];
  
  register(component: IPromptComponent): void;
  aggregate(context: PromptContext): AggregatedPrompt;
  preview(request: AIReplyRequest): PromptPreviewResult;
}

interface AggregatedPrompt {
  fullPrompt: string;
  sections: PromptSection[];
  metadata: PromptMetadata;
}
```

### 4. Default Components

| Component | Order | Description |
|-----------|-------|-------------|
| SystemPromptComponent | 10 | 系統提示詞 |
| MCPToolsPromptComponent | 20 | MCP 工具列表 |
| UserContextComponent | 30 | 使用者上下文 |
| ToolResultsComponent | 40 | 工具執行結果 |
| AIMessageComponent | 50 | AI 工作匯報 |
| ClosingPromptComponent | 100 | 結尾提示 |

### 5. CLI MCP Response Handler

```typescript
interface MCPResponseHandler {
  parseToolCalls(aiResponse: string): MCPToolCall[];
  executeTools(calls: MCPToolCall[]): Promise<MCPToolResult[]>;
  formatResultsPrompt(results: MCPToolResult[]): string;
}

class CLIMCPResponseHandler implements MCPResponseHandler {
  async handleResponse(
    aiResponse: string, 
    cliTerminal: CLITerminal
  ): Promise<CLIHandlerResult>;
}
```

## Decisions

### Decision 1: Component-based Architecture
**What**: 使用組件式架構而非單一函數
**Why**: 
- 符合 SOLID 原則中的單一責任原則 (SRP)
- 易於擴展新的提示詞區段
- 易於測試各個組件

### Decision 2: Singleton Pattern for Aggregator
**What**: PromptAggregator 使用單例模式
**Why**: 
- 確保全域一致性
- 避免重複註冊組件
- 與現有 AIProviderFactory 單例模式一致

### Decision 3: CLI MCP 回應循環
**What**: CLI 模式下解析 AI 回應，若包含 MCP 工具呼叫則執行並回送結果
**Why**: 
- 讓 CLI 模式具備與 API 模式相同的 MCP 整合能力
- 透過持久化終端實體維持對話上下文

## File Structure

```
src/utils/
├── prompt-aggregator/
│   ├── index.ts                 # 主要導出
│   ├── prompt-aggregator.ts     # 核心類別
│   ├── prompt-context.ts        # 上下文介面
│   ├── components/
│   │   ├── base-component.ts    # 基礎組件
│   │   ├── system-prompt.ts     # 系統提示詞
│   │   ├── mcp-tools.ts         # MCP 工具
│   │   ├── user-context.ts      # 使用者上下文
│   │   ├── tool-results.ts      # 工具結果
│   │   ├── ai-message.ts        # AI 訊息
│   │   └── closing.ts           # 結尾
│   └── handlers/
│       └── cli-mcp-handler.ts   # CLI MCP 處理器
```

## Migration Plan

1. **Phase 1**: 建立 PromptAggregator 基礎架構
2. **Phase 2**: 實作所有提示詞組件
3. **Phase 3**: 重構 Provider 使用 Aggregator
4. **Phase 4**: 移除 ai-service.ts 中的重複函數
5. **Phase 5**: 實作 CLI MCP 回應處理
6. **Phase 6**: 測試和驗證

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 重構可能破壞現有功能 | 漸進式重構，保持向後相容 |
| CLI MCP 循環可能造成無限迴圈 | 設定最大循環次數限制 |
| 組件式架構增加複雜度 | 提供清晰的文件和預設組件 |

## Open Questions
- Q: 是否需要支援自訂組件順序？A: 是，透過 `getOrder()` 方法
- Q: CLI MCP 循環的最大次數？A: 建議 10 次，可在設定中調整
