# Design: HTTP MCP Transport 實現設計

## Context

目前系統使用 `StdioServerTransport` 作為 MCP 傳輸層，這在以下場景中有限制：
- Docker 容器化部署（容器無法直接使用 stdio）
- 遠端 MCP 客戶端連線
- 多客戶端同時連線

MCP SDK (@modelcontextprotocol/sdk) 提供了多種 Server Transport：
- `StdioServerTransport` - 標準輸入/輸出傳輸（現有）
- `SSEServerTransport` - Server-Sent Events 傳輸
- `StreamableHTTPServerTransport` - 可串流 HTTP 傳輸

## Goals / Non-Goals

### Goals
- 實現 HTTP-based MCP 傳輸，支援 Docker 部署
- 保持與現有 stdio 模式的兼容性
- 提供簡單的配置方式切換傳輸模式
- 在 README.md 中提供完整的 HTTP 連線配置說明

### Non-Goals
- 不實現自訂認證機制（可依賴反向代理）
- 不實現 TLS（可透過反向代理實現 HTTPS）
- 不改變現有 Web Server 的功能

## Decisions

### Decision 1: 同時支援 SSE 和 Streamable HTTP Transport

**選擇**：實現 SSE 和 Streamable HTTP 兩種傳輸方式

**理由**：
- SSE 是成熟的 HTTP 傳輸方式，廣泛支援
- Streamable HTTP 是較新的標準，提供更好的雙向通訊
- 提供使用者選擇彈性

**傳輸模式選項**：
- `stdio` - 標準輸入/輸出（預設，用於本地 MCP 客戶端）
- `sse` - Server-Sent Events
- `streamable-http` - Streamable HTTP（現代 HTTP 串流）

### Decision 2: 在現有 Web Server 上增加 MCP 端點

**選擇**：複用現有 Express Web Server

**理由**：
- 減少端口數量（不需要額外的 MCP HTTP 端口）
- 簡化部署配置
- 複用現有的健康檢查和日誌系統

**端點設計**：
- `GET /mcp/sse` - SSE 連線端點
- `POST /mcp/message` - SSE 訊息發送端點
- `POST /mcp` - Streamable HTTP 端點（雙向）

### Decision 3: 傳輸模式配置方式

**選擇**：通過環境變數和命令列參數配置

- 環境變數：`MCP_TRANSPORT=stdio|sse|streamable-http`
- 命令列參數：`--transport stdio|sse|streamable-http`
- 預設值：`stdio`（保持向後兼容）
- Docker 預設：`sse`（或 `streamable-http`）

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI (cli.ts)                         │
│  --transport stdio|sse                                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCPServer                                │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │ StdioTransport  │ OR  │  SSETransport   │               │
│  │   (default)     │     │  (via Express)  │               │
│  └────────┬────────┘     └────────┬────────┘               │
│           │                       │                         │
│           ▼                       ▼                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              MCP Tool Handlers                          ││
│  │           (collect_feedback, etc.)                      ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    WebServer                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Express App                                             ││
│  │  - GET /           (Web UI)                             ││
│  │  - GET /health     (Health Check)                       ││
│  │  - POST /mcp/sse   (SSE endpoint) ←── NEW               ││
│  │  - POST /mcp/msg   (Message endpoint) ←── NEW           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

### Risk 1: SSE 連線管理複雜度
- **風險**：多客戶端連線可能導致資源消耗增加
- **緩解**：限制同時連線數，實現連線超時機制

### Risk 2: 與 Claude Desktop/Cursor 的兼容性
- **風險**：Claude Desktop 和 Cursor 主要使用 stdio
- **緩解**：保持 stdio 為預設，HTTP 模式僅在明確配置時啟用

## Migration Plan

1. **Phase 1**：實現 SSE Transport（不影響現有功能）
2. **Phase 2**：更新 Docker 配置使用 SSE 模式
3. **Phase 3**：更新文檔和 README

## Open Questions

- [ ] 是否需要支援認證機制？（初期可不實現，透過反向代理處理）
- [ ] SSE 連線的超時時間設定為多少？（建議 30 分鐘）
