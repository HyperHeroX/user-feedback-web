# Design: add-ai-conversation-ui

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  AI Reply Btn   │───▶│      aiStreamingPanel           │ │
│  │  Auto Timer     │    │  ┌─────────────────────────┐    │ │
│  └─────────────────┘    │  │ ConversationEntry       │    │ │
│                         │  │ - type: prompt|thinking │    │ │
│                         │  │        |tool|result|ai  │    │ │
│                         │  │ - timestamp             │    │ │
│                         │  │ - content               │    │ │
│                         │  │ - expandable            │    │ │
│                         │  └─────────────────────────┘    │ │
│                         └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │               AIProviderFactory                      │    │
│  │  ┌─────────────────┐  ┌─────────────────────────┐   │    │
│  │  │   getProvider   │  │    <<interface>>        │   │    │
│  │  │   (settings)    │  │    IAIProvider          │   │    │
│  │  └────────┬────────┘  │  + generateReply()      │   │    │
│  │           │           │  + getName(): string    │   │    │
│  │           │           └──────────┬──────────────┘   │    │
│  │           │                      │                  │    │
│  │           ▼                      │                  │    │
│  │  ┌────────────────┐    ┌────────┴───────┐          │    │
│  │  │ if mode='api'  │    │                │          │    │
│  │  │  → APIProvider │    │                │          │    │
│  │  │ if mode='cli'  │    ▼                ▼          │    │
│  │  │  → CLIProvider │ APIProvider    CLIProvider     │    │
│  │  └────────────────┘ (Gemini API)   (gemini/claude) │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## UI Component Design

### ConversationEntry Component

每個對話條目的結構：

```html
<div class="conversation-entry" data-type="prompt|thinking|tool|result|ai|error">
  <div class="entry-header">
    <span class="entry-icon">{icon}</span>
    <span class="entry-title">{title}</span>
    <span class="entry-mode">{API|CLI}</span>
    <span class="entry-timestamp">{HH:mm:ss}</span>
    <button class="entry-toggle">▼</button>
  </div>
  <div class="entry-content">
    <pre>{content}</pre>
  </div>
</div>
```

### 視覺主題對照

| Type | Icon | Background | Border |
|------|------|------------|--------|
| prompt | 📤 | rgba(59, 130, 246, 0.1) | #3b82f6 |
| thinking | 🤔 | rgba(107, 114, 128, 0.1) | #6b7280 |
| tool | 🔧 | rgba(249, 115, 22, 0.1) | #f97316 |
| result | 📋 | rgba(168, 85, 247, 0.1) | #a855f7 |
| ai | ✅ | rgba(34, 197, 94, 0.1) | #22c55e |
| error | ❌ | rgba(239, 68, 68, 0.1) | #ef4444 |

## Factory Pattern Implementation

### Interface Definition

```typescript
interface IAIProvider {
  generateReply(request: AIReplyRequest): Promise<AIReplyResponse>;
  getName(): string;
  getMode(): 'api' | 'cli';
}
```

### Factory Class

```typescript
class AIProviderFactory {
  static getProvider(settings: CLISettings): IAIProvider {
    if (settings?.aiMode === 'cli') {
      return new CLIProvider(settings);
    }
    return new APIProvider();
  }
}
```

## State Management

### Conversation State

```typescript
interface ConversationState {
  entries: ConversationEntry[];
  currentRound: number;
  mode: 'api' | 'cli';
  cliTool?: string;
  isProcessing: boolean;
}

interface ConversationEntry {
  id: string;
  type: 'prompt' | 'thinking' | 'tool' | 'result' | 'ai' | 'error';
  content: string;
  timestamp: Date;
  round: number;
  expanded: boolean;
  metadata?: Record<string, unknown>;
}
```

## Integration Points

### 1. 手動 AI 回覆

```
User clicks "AI 回覆" button
  → showConversationPanel()
  → AIProviderFactory.getProvider(settings)
  → addEntry(type: 'prompt', content: buildPrompt())
  → addEntry(type: 'thinking')
  → provider.generateReply()
  → addEntry(type: 'ai', content: response)
  → updateTextarea(response)
```

### 2. 自動 AI 回覆

```
Timer triggers autoReply
  → showConversationPanel()
  → Same flow as manual
  → Auto-submit if configured
```

## CSS Architecture

```
src/static/
├── style.css                    # 現有樣式
└── modules/
    └── conversation-panel.css   # 新增對話面板樣式 (可選，或整合至 style.css)
```

## Error Handling

### Stale Lock Detection

工廠模式需處理 CLI 工具不可用的情況：

1. 檢查 CLI 工具是否安裝
2. 如果 `cliFallbackToApi = true`，自動切換到 API 模式
3. 在 UI 顯示模式切換提示

## Testing Strategy

### Unit Tests
- AIProviderFactory 選擇邏輯
- ConversationEntry 渲染

### E2E Tests
- 手動 AI 回覆流程
- 自動 AI 回覆流程
- CLI/API 模式切換
