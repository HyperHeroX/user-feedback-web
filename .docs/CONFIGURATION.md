# user-feedback MCP Tools 配置指南

## 📋 环境变量配置

### 必需配置

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `MCP_API_KEY` | AI API密钥 | `sk-xxx...` |

### 可选配置

| 变量名 | 说明 | 默认值 | 有效范围 |
|--------|------|--------|----------|
| `MCP_API_BASE_URL` | AI API基础URL | `https://api.ssopen.top` | 有效URL |
| `MCP_DEFAULT_MODEL` | 默认AI模型 | `gpt-4o-mini` | 任意字符串 |
| `MCP_WEB_PORT` | Web服务器端口 | `5000` | 1024-65535 |
| `MCP_DIALOG_TIMEOUT` | 反馈收集超时时间（秒） | `60000` | 10-60000 |
| `MCP_ENABLE_CHAT` | 启用AI对话功能 | `true` | true/false |
| `MCP_CORS_ORIGIN` | CORS允许的源 | `*` | 任意字符串 |
| `MCP_MAX_FILE_SIZE` | 最大文件大小（字节） | `10485760` | 1024-104857600 |
| `MCP_ENABLE_IMAGE_TO_TEXT` | 启用图片转文字功能 | `true` | true/false |
| `MCP_IMAGE_TO_TEXT_PROMPT` | 图片转文字提示词 | 默认提示词 | 任意字符串 |
| `LOG_LEVEL` | 日志级别 | `info` | error/warn/info/debug |

## 🔧 MCP配置示例

### Cursor/Claude Desktop配置

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "node",
      "args": ["D:/path/to/dist/cli.js"],
      "env": {
        "MCP_API_KEY": "your-api-key-here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_DIALOG_TIMEOUT": "60000",
        "MCP_ENABLE_IMAGE_TO_TEXT": "true",
        "MCP_IMAGE_TO_TEXT_PROMPT": "请详细描述这张图片的内容，包括主要元素、颜色、布局、文字等信息。"
      }
    }
  }
}
```

### NPX配置（推荐）

```json
{
  "mcpServers": {
    "user-web-feedback": {
      "command": "npx",
      "args": ["user-web-feedback"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_API_BASE_URL": "https://api.ssopen.top",
        "MCP_DEFAULT_MODEL": "grok-3",
        "MCP_DIALOG_TIMEOUT": "60000"
      }
    }
  }
}
```

## ⏱️ 超时时间配置详解

### 环境变量方式

```bash
# 设置默认超时时间为16.7小时
export MCP_DIALOG_TIMEOUT="60000"
```

### MCP配置方式

```json
{
  "env": {
    "MCP_DIALOG_TIMEOUT": "60000"
  }
}
```

### 工具函数调用

```typescript
// 超时时间统一从环境变量读取
collect_feedback("工作汇报内容")
```

### 超时时间配置

超时时间通过环境变量 `MCP_DIALOG_TIMEOUT` 统一管理：

1. **环境变量 MCP_DIALOG_TIMEOUT** - 统一配置
2. **默认值 60000秒** - 备用默认值

### 超时时间建议

| 使用场景 | 建议时间 | 说明 |
|---------|---------|------|
| 快速测试 | 60-300秒 | 用于功能验证 |
| 日常使用 | 1800-3600秒 | 平衡用户体验 |
| 详细反馈 | 7200-14400秒 | 复杂项目评审 |
| 长期收集 | 21600-60000秒 | 持续反馈收集 |
| 演示展示 | 300-600秒 | 避免等待过久 |

## 🎯 常用配置场景

### 快速测试（短超时）

```json
{
  "env": {
    "MCP_DIALOG_TIMEOUT": "60"
  }
}
```

### 详细反馈（长超时）

```json
{
  "env": {
    "MCP_DIALOG_TIMEOUT": "1800"
  }
}
```

### 生产环境（平衡配置）

```json
{
  "env": {
    "MCP_API_KEY": "your_production_key",
    "MCP_API_BASE_URL": "https://api.ssopen.top",
    "MCP_DEFAULT_MODEL": "grok-3",
    "MCP_DIALOG_TIMEOUT": "600",
    "MCP_WEB_PORT": "5000",
    "MCP_ENABLE_CHAT": "true",
    "LOG_LEVEL": "info"
  }
}
```

## 📝 提示詞自定義配置

### 功能說明

提示詞自定義功能允許用戶自定義 AI 回覆時使用的提示詞順序。系統支援兩種順序配置：
- **第一次順序** - 首次 AI 呼叫時使用的順序
- **第二次順序** - 後續 AI 呼叫時使用的順序

### 可配置的提示詞組件

| 組件 ID | 預設名稱 | 說明 |
|---------|----------|------|
| `system_prompt` | 系統提示詞 | 系統級指令 |
| `mcp_tools` | MCP 工具說明 | MCP 工具使用說明 |
| `user_context` | 用戶上下文 | 用戶提供的上下文 |
| `tool_results` | 工具執行結果 | MCP 工具執行結果 |
| `closing` | 結尾提示 | 結尾指令 |

### API 端點

```bash
# 獲取所有提示詞配置
GET /api/settings/prompts

# 更新提示詞配置
PUT /api/settings/prompts
Content-Type: application/json
{
  "prompts": [
    { "id": "system_prompt", "firstOrder": 10, "secondOrder": 10, "enabled": true }
  ]
}

# 重置為預設配置
POST /api/settings/prompts/reset
```

### 使用方式

1. 訪問 設定頁面 → AI 提示詞設定
2. 調整各組件的第一次/第二次順序
3. 啟用/停用特定組件
4. 點擊「儲存提示詞設定」

## 🔌 擴展 API 提供商配置

### NVIDIA API 配置

NVIDIA 提供 OpenAI-compatible API，可用於 LLaMA、Nemotron 等模型。

```json
{
  "provider": "nvidia",
  "apiKey": "your-nvidia-api-key",
  "baseUrl": "https://integrate.api.nvidia.com/v1",
  "model": "nvidia/llama-3.1-nemotron-70b-instruct"
}
```

**支援的模型**（部分）：
- `nvidia/llama-3.1-nemotron-70b-instruct`
- `nvidia/llama-3.1-405b-instruct`

### Z.AI (Zhipu AI) API 配置

Z.AI（智譜 AI）提供 GLM 系列模型。支援國際版和中國版。

**國際版配置**：
```json
{
  "provider": "zai",
  "region": "international",
  "apiKey": "your-zai-api-key",
  "model": "glm-4"
}
```

**中國版配置**：
```json
{
  "provider": "zai",
  "region": "china",
  "apiKey": "your-bigmodel-api-key",
  "model": "glm-4"
}
```

**API Endpoints**：
- 國際版：`https://api.z.ai/api/paas/v4`
- 中國版：`https://open.bigmodel.cn/api/paas/v4`

**支援的模型**：
- `glm-4`
- `glm-4-plus`
- `glm-4-flash`

### 使用方式

1. 訪問 設定頁面 → 擴展 API 提供商
2. 選擇 NVIDIA 或 Z.AI 標籤
3. 填入 API Key 和 Model ID
4. 點擊「測試連接」驗證設定
5. 點擊「儲存設定」

## 📄 图片转文字功能配置

### 功能说明

图片转文字功能可以将用户上传的图片转换为详细的文字描述，解决部分MCP客户端无法显示图片的兼容性问题。

### 配置选项

```json
{
  "env": {
    "MCP_ENABLE_IMAGE_TO_TEXT": "true",
    "MCP_IMAGE_TO_TEXT_PROMPT": "请详细描述这张图片的内容，包括主要元素、颜色、布局、文字等信息。"
  }
}
```

### 使用流程

1. **上传图片** - 用户在反馈表单中上传图片
2. **点击转换** - 点击"📄 图片转文本"按钮
3. **AI处理** - 使用配置的API和模型分析图片
4. **预览编辑** - 用户可以查看和编辑AI生成的描述
5. **提交反馈** - 同时包含原图和文字描述

### 兼容性优势

- **支持图片的客户端**: 可以看到图片和描述
- **不支持图片的客户端**: 可以看到详细的文字描述
- **完美兼容**: 满足不同客户端的需求

## 🔍 配置验证

### 检查当前配置

```bash
npx user-web-feedback config
```

### 健康检查

```bash
npx user-web-feedback health
```

### 测试配置

```bash
npx user-web-feedback test-feedback --timeout 120
```

## ⚠️ 注意事项

1. **超时时间范围**: 必须在10-60000秒之间
2. **端口冲突**: 确保指定的端口未被占用
3. **API密钥**: 生产环境中请妥善保管API密钥
4. **文件大小**: 图片上传受`MCP_MAX_FILE_SIZE`限制
5. **网络环境**: 确保能访问指定的API基础URL

## 🐛 故障排除

### 配置无效

```bash
# 检查配置语法
npx user-web-feedback config

# 查看详细错误信息
LOG_LEVEL=debug npx user-web-feedback start
```

### 超时问题

```bash
# 增加超时时间
export MCP_DIALOG_TIMEOUT="900"

# 或在MCP配置中设置
{
  "env": {
    "MCP_DIALOG_TIMEOUT": "900"
  }
}
```

### 端口冲突

```bash
# 使用不同端口
export MCP_WEB_PORT="8080"
```
