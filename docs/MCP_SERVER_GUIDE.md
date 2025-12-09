# MCP Server 設定指南

本文件說明如何在 user-feedback-web 專案中設定和使用 MCP (Model Context Protocol) Server。

## 目錄

- [概述](#概述)
- [快速開始](#快速開始)
- [傳輸方式](#傳輸方式)
- [設定 MCP Server](#設定-mcp-server)
- [AI 呼叫 MCP Server](#ai-呼叫-mcp-server)
- [API 參考](#api-參考)
- [常見問題](#常見問題)

## 概述

MCP (Model Context Protocol) 是一個標準化的協議，允許 AI 助手與外部工具和資源進行互動。本專案支援以下功能：

- 連接多個 MCP Server
- 支援 stdio、SSE、HTTP 三種傳輸方式
- 呼叫 MCP 工具
- 讀取 MCP 資源
- 獲取 MCP 提示詞

## 快速開始

### 1. 開啟 MCP Server 設定

點擊右上角的 **🔌 MCP** 按鈕，開啟 MCP Server 管理介面。

### 2. 新增 MCP Server

點擊「新增 Server」按鈕，填寫以下資訊：

- **名稱**：Server 的顯示名稱
- **傳輸方式**：選擇 stdio / SSE / Streamable HTTP
- **命令/URL**：根據傳輸方式填寫對應資訊

### 3. 連接 Server

勾選「啟用此 Server」後，點擊連接按鈕即可建立連接。

## 傳輸方式

### stdio（本地程序）

適用於本地安裝的 MCP Server，通過標準輸入/輸出進行通訊。

```json
{
  "name": "time-server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@anthropic/mcp-server-time"],
  "env": {}
}
```

### SSE（Server-Sent Events）

適用於遠端 MCP Server，通過 HTTP SSE 進行通訊。

```json
{
  "name": "remote-server",
  "transport": "sse",
  "url": "http://localhost:3000/mcp/sse"
}
```

### Streamable HTTP

適用於支援雙向 HTTP 串流的 MCP Server。

```json
{
  "name": "http-server",
  "transport": "streamable-http",
  "url": "http://localhost:3000/mcp"
}
```

## 設定 MCP Server

### 常用 MCP Server 範例

#### 1. 時間伺服器 (Time Server)

```
名稱: time-server
傳輸方式: stdio
命令: npx
參數: 
  -y
  @anthropic/mcp-server-time
```

提供的工具：
- `get_current_time` - 獲取當前時間

#### 2. 檔案系統伺服器 (Filesystem Server)

```
名稱: filesystem
傳輸方式: stdio
命令: npx
參數:
  -y
  @anthropic/mcp-server-filesystem
  /path/to/allowed/directory
```

提供的工具：
- `read_file` - 讀取檔案
- `write_file` - 寫入檔案
- `list_directory` - 列出目錄

#### 3. GitHub 伺服器

```
名稱: github
傳輸方式: stdio
命令: npx
參數:
  -y
  @modelcontextprotocol/server-github
環境變數:
  GITHUB_PERSONAL_ACCESS_TOKEN=your_token_here
```

#### 4. SQLite 伺服器

```
名稱: sqlite
傳輸方式: stdio
命令: npx
參數:
  -y
  @anthropic/mcp-server-sqlite
  /path/to/database.db
```

## AI 呼叫 MCP Server

### 在 AI 對話中使用 MCP 工具

當 MCP Server 連接成功後，AI 可以使用以下語法呼叫工具：

#### 基本語法

```
請使用 MCP 工具 {tool_name} 來 {描述動作}
```

#### 範例

##### 獲取當前時間

```
請使用 MCP 工具 get_current_time 獲取當前時間
```

##### 讀取檔案

```
請使用 MCP 工具 read_file 讀取 /path/to/file.txt 的內容
```

##### 列出目錄

```
請使用 MCP 工具 list_directory 列出 /home/user/documents 目錄下的檔案
```

### 程式化呼叫 MCP 工具

#### JavaScript API

```javascript
// 呼叫 MCP 工具
const response = await fetch('/api/mcp-servers/1/tools/get_current_time/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: { timezone: 'Asia/Taipei' }
  })
});

const result = await response.json();
console.log(result);
// { success: true, content: [{ type: 'text', text: '2024-12-10T15:30:00+08:00' }] }
```

#### 批次呼叫多個工具

```javascript
// 獲取所有已連接伺服器的工具
const toolsResponse = await fetch('/api/mcp-tools');
const { tools } = await toolsResponse.json();

// 找到特定工具並呼叫
const timeTool = tools.find(t => t.name === 'get_current_time');
if (timeTool) {
  const result = await callMCPTool(timeTool.serverId, 'get_current_time', {});
}
```

## API 參考

### MCP Server 管理

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/mcp-servers` | 獲取所有 MCP Server |
| POST | `/api/mcp-servers` | 創建新的 MCP Server |
| PUT | `/api/mcp-servers/:id` | 更新 MCP Server |
| DELETE | `/api/mcp-servers/:id` | 刪除 MCP Server |
| PUT | `/api/mcp-servers/:id/toggle` | 切換啟用狀態 |

### MCP 連接管理

| 方法 | 端點 | 說明 |
|------|------|------|
| POST | `/api/mcp-servers/:id/connect` | 連接 MCP Server |
| POST | `/api/mcp-servers/:id/disconnect` | 斷開 MCP Server |
| POST | `/api/mcp-servers/connect-all` | 連接所有已啟用的 Server |
| POST | `/api/mcp-servers/disconnect-all` | 斷開所有 Server |

### MCP 工具操作

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/mcp-servers/:id/tools` | 獲取 Server 的工具列表 |
| GET | `/api/mcp-tools` | 獲取所有已連接 Server 的工具 |
| POST | `/api/mcp-servers/:id/tools/:toolName/call` | 呼叫工具 |

### 請求/響應格式

#### 創建 MCP Server

**請求：**

```json
{
  "name": "my-server",
  "transport": "stdio",
  "command": "npx",
  "args": ["-y", "@anthropic/mcp-server-time"],
  "env": {},
  "enabled": true
}
```

**響應：**

```json
{
  "success": true,
  "server": {
    "id": 1,
    "name": "my-server",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@anthropic/mcp-server-time"],
    "enabled": true,
    "createdAt": "2024-12-10T10:00:00Z",
    "updatedAt": "2024-12-10T10:00:00Z"
  }
}
```

#### 呼叫工具

**請求：**

```json
{
  "arguments": {
    "timezone": "Asia/Taipei"
  }
}
```

**響應：**

```json
{
  "success": true,
  "content": [
    {
      "type": "text",
      "text": "Current time in Asia/Taipei: 2024-12-10T15:30:00+08:00"
    }
  ]
}
```

## 常見問題

### Q: MCP Server 連接失敗怎麼辦？

**A:** 請檢查以下項目：

1. 確認命令/URL 是否正確
2. 對於 stdio 傳輸，確認相關套件已安裝
3. 檢查環境變數是否正確設定
4. 查看系統日誌中的錯誤訊息

### Q: 如何知道 MCP Server 提供哪些工具？

**A:** 連接成功後，在 MCP Server 列表中會顯示工具數量。點擊展開可查看工具名稱和描述。

### Q: 可以同時連接多個 MCP Server 嗎？

**A:** 是的，系統支援同時連接多個 MCP Server，所有工具會匯總顯示。

### Q: 如何在 AI 對話中自動使用 MCP 工具？

**A:** 目前需要在對話中明確要求 AI 使用特定工具。未來版本將支援 AI 自動識別並選擇適當的工具。

---

## 延伸閱讀

- [Model Context Protocol 官方文件](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Anthropic MCP Servers](https://github.com/anthropics/mcp-servers)
