# Technical Design: AI 回覆提示詞自定義系統

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Settings UI                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Prompt Customization Panel                 │    │
│  │  ┌─────────┬──────┬──────┬────────┐                │    │
│  │  │ Prompt  │ 1st  │ 2nd  │ Enable │                │    │
│  │  │ Name    │ Order│ Order│   ☑    │                │    │
│  │  ├─────────┼──────┼──────┼────────┤                │    │
│  │  │ System  │  1   │  1   │   ☑    │                │    │
│  │  │ MCP     │  2   │  -   │   ☑    │                │    │
│  │  │ Context │  3   │  2   │   ☑    │                │    │
│  │  └─────────┴──────┴──────┴────────┘                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           API Provider Settings                      │    │
│  │  [ OpenAI ] [ Claude ] [ Gemini ] [ NVIDIA ] [ Z.AI ]│    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend API                              │
│  GET  /api/settings/prompts       - 獲取提示詞設定           │
│  PUT  /api/settings/prompts       - 更新提示詞設定           │
│  POST /api/settings/prompts/reset - 重置為預設              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Database                                 │
│  prompt_configs: id, name, content, first_order,            │
│                  second_order, enabled, updated_at          │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Table: prompt_configs

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

### 預設提示詞配置

| id | name | display_name | first_order | second_order | enabled |
|----|------|--------------|-------------|--------------|---------|
| system_prompt | SystemPrompt | 系統提示詞 | 10 | 10 | 1 |
| mcp_tools | MCPTools | MCP 工具說明 | 20 | 0 | 1 |
| user_context | UserContext | 用戶上下文 | 30 | 20 | 1 |
| tool_results | ToolResults | 工具執行結果 | 40 | 30 | 1 |
| closing | ClosingPrompt | 結尾提示 | 100 | 100 | 1 |

## API Design

### GET /api/settings/prompts

獲取所有提示詞配置。

**Response:**
```json
{
  "success": true,
  "prompts": [
    {
      "id": "system_prompt",
      "name": "SystemPrompt",
      "displayName": "系統提示詞",
      "content": "你是一個有幫助的 AI 助手...",
      "firstOrder": 10,
      "secondOrder": 10,
      "enabled": true,
      "editable": true
    }
  ]
}
```

### PUT /api/settings/prompts

更新提示詞配置。

**Request:**
```json
{
  "prompts": [
    {
      "id": "system_prompt",
      "content": "更新後的內容...",
      "firstOrder": 10,
      "secondOrder": 10,
      "enabled": true
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "提示詞設定已更新"
}
```

### POST /api/settings/prompts/reset

重置為預設配置。

**Response:**
```json
{
  "success": true,
  "message": "已重置為預設設定"
}
```

## API Provider Extensions

### NVIDIA Provider Configuration

```typescript
interface NVIDIAConfig {
  provider: 'nvidia';
  apiKey: string;
  baseUrl: string;  // default: https://integrate.api.nvidia.com/v1
  model: string;
}

// 使用 OpenAI-compatible 模式
const nvidiaProvider = new OpenAICompatibleProvider({
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  apiKey: config.apiKey,
  model: config.model,
  // /chat/completions 後綴自動添加
});
```

### Z.AI Provider Configuration

```typescript
interface ZAIConfig {
  provider: 'zai';
  apiKey: string;
  region: 'international' | 'china';
  model: string;
}

// 根據地區選擇 endpoint
const endpoints = {
  international: 'https://api.z.ai/api/paas/v4',
  china: 'https://open.bigmodel.cn/api/paas/v4'
};

const zaiProvider = new OpenAICompatibleProvider({
  baseUrl: endpoints[config.region],
  apiKey: config.apiKey,
  model: config.model,
  headers: {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json'
  }
});
```

## UI Components

### PromptConfigPanel

```html
<section class="settings-section" id="promptConfigSection">
  <h2>📝 AI 提示詞設定</h2>
  
  <div class="prompt-list">
    <!-- 動態生成 -->
  </div>
  
  <div class="prompt-actions">
    <button id="savePromptConfig">儲存設定</button>
    <button id="resetPromptConfig">恢復預設</button>
  </div>
</section>
```

### PromptConfigItem

```html
<div class="prompt-config-item" data-id="system_prompt">
  <div class="prompt-header">
    <span class="prompt-name">系統提示詞</span>
    <div class="prompt-controls">
      <label>第一次順序:
        <input type="number" class="first-order" value="10" min="0">
      </label>
      <label>第二次順序:
        <input type="number" class="second-order" value="10" min="0">
      </label>
      <label>
        <input type="checkbox" class="prompt-enabled" checked>
        啟用
      </label>
    </div>
  </div>
  <div class="prompt-content">
    <textarea class="prompt-editor">提示詞內容...</textarea>
  </div>
</div>
```

### API Provider Dropdown

```html
<div class="form-group">
  <label for="aiProvider">AI 提供商</label>
  <select id="aiProvider">
    <option value="openai">OpenAI</option>
    <option value="anthropic">Anthropic (Claude)</option>
    <option value="google">Google (Gemini)</option>
    <option value="nvidia">NVIDIA</option>
    <option value="zai">Z.AI (Zhipu AI)</option>
  </select>
</div>

<!-- NVIDIA 設定區塊 -->
<div id="nvidiaSettings" class="provider-settings" style="display:none;">
  <div class="form-group">
    <label>Endpoint</label>
    <input type="text" id="nvidiaEndpoint" 
           value="https://integrate.api.nvidia.com/v1">
  </div>
  <div class="form-group">
    <label>API Key</label>
    <input type="password" id="nvidiaApiKey">
  </div>
  <div class="form-group">
    <label>Model</label>
    <input type="text" id="nvidiaModel" placeholder="nvidia/llama-3.1-nemotron-70b-instruct">
  </div>
</div>

<!-- Z.AI 設定區塊 -->
<div id="zaiSettings" class="provider-settings" style="display:none;">
  <div class="form-group">
    <label>地區</label>
    <select id="zaiRegion">
      <option value="international">國際版 (api.z.ai)</option>
      <option value="china">中國版 (bigmodel.cn)</option>
    </select>
  </div>
  <div class="form-group">
    <label>API Key</label>
    <input type="password" id="zaiApiKey">
  </div>
  <div class="form-group">
    <label>Model</label>
    <input type="text" id="zaiModel" placeholder="glm-4">
  </div>
</div>
```

## PromptAggregator Integration

修改 `PromptAggregator` 以支援動態順序：

```typescript
interface AggregationContext {
  isFirstCall: boolean;
  // ... 現有欄位
}

class PromptAggregator {
  async aggregate(context: AggregationContext): Promise<string> {
    const configs = await this.loadPromptConfigs();
    const orderField = context.isFirstCall ? 'firstOrder' : 'secondOrder';
    
    // 過濾已啟用且有順序的組件
    const activeConfigs = configs
      .filter(c => c.enabled && c[orderField] > 0)
      .sort((a, b) => a[orderField] - b[orderField]);
    
    // 依順序組合提示詞
    const sections: string[] = [];
    for (const config of activeConfigs) {
      const component = this.components.get(config.id);
      if (component) {
        const content = await component.build(context);
        if (content) sections.push(content);
      }
    }
    
    return sections.join('\n\n');
  }
}
```

## File Structure

```
src/
├── types/
│   └── index.ts              # 新增 PromptConfig, NVIDIAConfig, ZAIConfig
├── utils/
│   ├── database.ts           # 新增 prompt_configs 相關函數
│   ├── prompt-aggregator/
│   │   └── prompt-aggregator.ts  # 修改以支援動態配置
│   └── api-providers/
│       ├── nvidia-provider.ts    # 新增
│       └── zai-provider.ts       # 新增
├── server/
│   └── web-server.ts         # 新增 /api/settings/prompts 端點
└── static/
    ├── settings.html         # 新增提示詞設定區塊
    └── settings.js           # 新增提示詞管理邏輯
```

## Migration Strategy

1. 在資料庫初始化時檢查 `prompt_configs` 表是否存在
2. 若不存在，創建表並插入預設配置
3. 若存在，保留用戶自定義設定
4. 提供 API 端點供 UI 重置為預設

## Error Handling

### Provider Errors
- 連接失敗：顯示錯誤訊息，提供重試選項
- 認證失敗：提示用戶檢查 API Key
- 模型不支援：顯示可用模型列表

### Prompt Config Errors
- 驗證順序值範圍 (0-1000)
- 防止所有提示詞都被停用
- 內容長度限制 (例如 10000 字元)
