# Tasks: 增加 HTTP MCP Transport 支援

## 1. 核心實現

- [x] 1.1 新增傳輸類型定義
  - 在 `src/types/index.ts` 新增 `MCPServerTransportMode` 類型
  - 定義 `'stdio' | 'sse' | 'streamable-http'` 選項

- [x] 1.2 更新配置模組
  - 在 `src/config/index.ts` 新增 `mcpTransport` 配置項
  - 新增 `MCP_TRANSPORT` 環境變數支援
  - 預設值為 `'stdio'`

- [x] 1.3 實現 SSE Transport 整合
  - 在 `src/server/mcp-server.ts` 中新增 `startWithHTTPTransport()` 方法
  - 使用 `@modelcontextprotocol/sdk/server/sse.js` 的 `SSEServerTransport`
  - 實現 SSE 連線管理

- [x] 1.4 實現 Streamable HTTP Transport 整合
  - 在 `src/server/web-server.ts` 中新增 `setupStreamableHTTPEndpoints()` 方法
  - 使用 `@modelcontextprotocol/sdk/server/streamableHttp.js` 的 `StreamableHTTPServerTransport`

- [x] 1.5 新增 Web Server MCP 端點
  - 在 `src/server/web-server.ts` 新增 `GET /mcp/sse` SSE 端點
  - 新增 `POST /mcp/message` SSE 訊息端點
  - 新增 `POST /mcp` Streamable HTTP 端點
  - 整合兩種 Transport 到 Express 應用

## 2. CLI 更新

- [x] 2.1 新增 `--transport` 命令列參數
  - 在 `src/cli.ts` 新增 `--transport <type>` 選項
  - 支援 `stdio`、`sse` 和 `streamable-http` 三種模式
  - 更新幫助文字說明

- [x] 2.2 更新啟動邏輯
  - 根據傳輸模式選擇啟動方法
  - stdio 模式：使用現有 `start()` 方法
  - sse/streamable-http 模式：使用新的 `startWithHTTPTransport()` 方法

## 3. Docker 配置更新

- [x] 3.1 更新 Dockerfile
  - 新增 `MCP_TRANSPORT` 環境變數預設為 `sse`
  - 更新啟動命令

- [x] 3.2 更新 docker-compose.yml
  - 新增 `MCP_TRANSPORT` 環境變數
  - 新增 `MCP_WEB_PORT` 環境變數
  - 更新端口映射說明
  - 新增健康檢查配置

## 4. 文檔更新

- [x] 4.1 更新 README.md - HTTP 連線配置
  - 新增 "HTTP 傳輸模式（Docker 部署）" 章節
  - 新增 MCP Server HTTP 配置範例
  - 說明如何在 Claude Desktop/Cursor 中配置 HTTP MCP Server

- [x] 4.2 更新 README.md - Docker 部署說明
  - 更新 Docker 部署章節
  - 新增 HTTP 模式的 docker-compose 範例
  - 新增環境變數配置說明

## 5. 測試驗證

- [x] 5.1 本地測試
  - 測試編譯無錯誤：`npm run build` 成功
  - 測試單元測試通過：195 個測試全部通過

- [x] 5.2 整合測試（用戶已驗證）
  - 使用 VSCode MCP 客戶端測試 SSE 連線 ✓
  - 驗證 collect_feedback 工具在 SSE 模式下正常運作 ✓
  - 驗證 Docker 容器部署 ✓
