# Change: 增加 HTTP 傳輸支援以實現 Docker 部署

## Why

目前 MCP Server 僅支援 stdio 傳輸模式，這在 Docker 容器化部署時無法使用，因為容器環境無法直接使用 stdio 與外部 MCP 客戶端通訊。需要增加 HTTP（SSE/Streamable HTTP）傳輸支援，使系統能夠在 Docker 環境中運行並接受遠端連線。

## What Changes

- **新增 HTTP 傳輸模式**：實現 SSE 或 Streamable HTTP Server Transport，允許 MCP 客戶端通過 HTTP 連線到 MCP Server
- **新增啟動參數**：增加 `--transport` 參數選擇傳輸模式（stdio/sse/http）
- **新增 HTTP 端點**：在 Web Server 中增加 MCP SSE/HTTP 端點
- **更新 Docker 配置**：修改 Dockerfile 和 docker-compose.yml 以支援 HTTP 模式
- **更新 README 文檔**：增加 HTTP 連線配置說明

## Impact

- Affected specs: (新增) `http-mcp-transport`
- Affected code:
  - `src/server/mcp-server.ts` - 新增 HTTP 傳輸支援
  - `src/server/web-server.ts` - 新增 MCP HTTP 端點
  - `src/cli.ts` - 新增 `--transport` 參數
  - `src/config/index.ts` - 新增傳輸相關配置
  - `Dockerfile` - 更新預設啟動模式
  - `docker-compose.yml` - 更新環境變數
  - `README.md` - 新增 HTTP 連線配置說明
