# Design: add-prompt-customization-ui

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Settings Page UI                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │ AI 提示詞設定    │  │ 擴展 API 提供商                  │   │
│  │ - 順序調整      │  │ ┌─────────┐ ┌─────────────────┐ │   │
│  │ - 啟用/停用     │  │ │ NVIDIA  │ │ Z.AI (Zhipu)    │ │   │
│  └────────┬────────┘  │ └─────────┘ └─────────────────┘ │   │
│           │           └─────────────────────────────────────┘   │
└───────────┼─────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    REST API Layer                            │
│  GET/PUT /api/settings/prompts                               │
│  POST /api/settings/prompts/reset                            │
└───────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
│  prompt_configs table                                        │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS prompt_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  content TEXT,
  first_order INTEGER DEFAULT 0,
  second_order INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  editable INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### 預設提示詞組件

| ID | Name | Display Name | First Order | Second Order |
|----|------|--------------|-------------|--------------|
| system_prompt | System Prompt | 系統提示詞 | 10 | 10 |
| mcp_tools | MCP Tools | MCP 工具說明 | 20 | 0 |
| user_context | User Context | 用戶上下文 | 30 | 20 |
| tool_results | Tool Results | 工具執行結果 | 0 | 30 |
| closing | Closing | 結尾提示 | 40 | 40 |

## API Design

### GET /api/settings/prompts

返回所有提示詞配置。

```json
{
  "success": true,
  "prompts": [
    {
      "id": "system_prompt",
      "name": "System Prompt",
      "displayName": "系統提示詞",
      "content": null,
      "firstOrder": 10,
      "secondOrder": 10,
      "enabled": true,
      "editable": false
    }
  ]
}
```

### PUT /api/settings/prompts

更新提示詞配置。

```json
{
  "prompts": [
    {
      "id": "system_prompt",
      "firstOrder": 10,
      "secondOrder": 10,
      "enabled": true
    }
  ]
}
```

### POST /api/settings/prompts/reset

重置為預設配置。

## TypeScript Interfaces

```typescript
interface PromptConfig {
  id: string;
  name: string;
  displayName: string;
  content: string | null;
  firstOrder: number;
  secondOrder: number;
  enabled: boolean;
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PromptConfigRequest {
  prompts: Array<{
    id: string;
    firstOrder?: number;
    secondOrder?: number;
    enabled?: boolean;
    content?: string | null;
  }>;
}
```

## PromptAggregator Integration

修改 `aggregate()` 方法：

1. 從資料庫獲取 prompt_configs
2. 根據 `context.isFirstCall` 選擇使用 `firstOrder` 或 `secondOrder`
3. 過濾 `enabled=true` 且 `order > 0` 的組件
4. 按 order 排序組合提示詞

## UI Components

### 提示詞設定區塊

```html
<section class="settings-section">
  <h2>📝 AI 提示詞設定</h2>
  <div id="promptConfigList">
    <!-- 動態生成 -->
  </div>
  <button id="resetPromptsBtn">恢復預設</button>
  <button id="savePromptsBtn">儲存</button>
</section>
```

### 擴展 API 提供商區塊

```html
<section class="settings-section">
  <h2>🔌 擴展 API 提供商</h2>
  <div class="provider-tabs">
    <button data-provider="nvidia">NVIDIA</button>
    <button data-provider="zai">Z.AI</button>
  </div>
  <div id="nvidiaSettings">...</div>
  <div id="zaiSettings">...</div>
</section>
```

## File Changes

| File | Action |
|------|--------|
| src/types/ai-provider.ts | ADD PromptConfig types |
| src/utils/database.ts | ADD prompt_configs CRUD |
| src/server/web-server.ts | ADD API endpoints |
| src/utils/prompt-aggregator/prompt-aggregator.ts | MODIFY aggregate() |
| src/static/settings.html | ADD UI sections |
| src/static/settings.js | ADD JS handlers |
