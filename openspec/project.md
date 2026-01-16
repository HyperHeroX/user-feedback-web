# Project: User Feedback Web

## Overview

User Feedback Web 是一個基於 Node.js 的 MCP (Model Context Protocol) 回饋收集系統，提供 AI 助手與用戶之間的互動介面。

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Backend**: Express.js
- **Real-time**: Socket.IO (WebSocket)
- **Database**: SQLite (better-sqlite3)
- **MCP**: @modelcontextprotocol/sdk
- **Frontend**: 原生 HTML/CSS/JavaScript

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        CLI Entry                                │
│                       (src/cli.ts)                              │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                        MCPServer                                │
│                   (src/server/mcp-server.ts)                    │
│   - MCP Protocol Handler                                        │
│   - Tool Registration (collect_feedback)                        │
│   - Transport Management (stdio/sse/http)                       │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                        WebServer                                │
│                   (src/server/web-server.ts)                    │
│   - Express.js HTTP Server                                      │
│   - Socket.IO Real-time                                         │
│   - API Endpoints                                               │
│   - Static File Serving                                         │
└────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   SessionStorage │ │   Database       │ │   MCP Client     │
│                  │ │   (SQLite)       │ │   Manager        │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Key Components

### MCPServer (`src/server/mcp-server.ts`)
- 處理 MCP 協議通訊
- 註冊 `collect_feedback` 工具
- 支援多種傳輸模式 (stdio, sse, streamable-http)

### WebServer (`src/server/web-server.ts`)
- 提供 Web UI 和 API
- 管理 WebSocket 連接
- 處理用戶回饋收集

### SessionStorage (`src/utils/session-storage.ts`)
- 管理活躍會話
- 處理會話過期清理
- 支援專案分組

### Database (`src/utils/database.ts`)
- SQLite 持久化存儲
- 加密 API Key 存儲
- 設定和日誌管理

### MCPClientManager (`src/utils/mcp-client-manager.ts`)
- 管理外部 MCP 伺服器連接
- 支援自動重連
- 工具調用路由

## Configuration

主要配置位於 `src/config/index.ts`，支援環境變數：

| Variable | Default | Description |
|----------|---------|-------------|
| MCP_WEB_PORT | 5050 | Web 伺服器連接埠 |
| MCP_DIALOG_TIMEOUT | 60 | 對話逾時（秒）|
| MCP_TRANSPORT | stdio | MCP 傳輸模式 |
| LOG_LEVEL | info | 日誌級別 |

## Development

```bash
# 開發模式
npm run dev

# 構建
npm run build

# 測試
npm test

# 啟動
npm start
```

## Related Documentation

- [README.md](../README.md)
- [Configuration Guide](../.docs/CONFIGURATION.md)
- [MCP Server Guide](../docs/MCP_SERVER_GUIDE.md)
