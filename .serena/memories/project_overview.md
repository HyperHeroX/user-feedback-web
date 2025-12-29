# User Feedback Web Project

## 概述
這是一個基於 Node.js 的 MCP (Model Context Protocol) 回饋收集器，支持 AI 工作匯報和用戶回饋收集。

## 技術棧
- **運行時**: Node.js >= 18.0.0
- **語言**: TypeScript (ESM 模組)
- **套件管理**: pnpm
- **框架**: Express.js, Socket.IO
- **資料庫**: better-sqlite3
- **MCP SDK**: @modelcontextprotocol/sdk

## 主要功能
- MCP Server 管理（連接、斷開、自動重連）
- 用戶回饋收集
- AI 工作匯報
- WebSocket 實時通知
- 圖片處理和轉文字

## 重要命令
```bash
pnpm build      # 編譯專案
pnpm test       # 執行單元測試
pnpm start      # 啟動伺服器
pnpm dev        # 開發模式
```

## 專案結構
- `src/server/` - MCP 和 Web 伺服器
- `src/utils/` - 工具函數（mcp-client-manager, logger, database 等）
- `src/static/` - 前端靜態資源
- `src/types/` - TypeScript 類型定義
- `src/__tests__/` - 單元測試

## 程式碼規範
- 使用 TypeScript strict mode
- 優先使用 Serena MCP 工具進行程式碼探索
- 遵循現有程式碼風格
- 不添加多餘註解
