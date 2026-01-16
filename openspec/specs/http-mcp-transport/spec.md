# http-mcp-transport Specification

## Purpose
TBD - created by archiving change add-http-mcp-transport. Update Purpose after archive.
## Requirements
### Requirement: MCP Server 傳輸模式選擇

系統 SHALL 支援通過配置選擇 MCP Server 的傳輸模式，包括 stdio、SSE（Server-Sent Events）和 Streamable HTTP 三種方式。

#### Scenario: 使用預設 stdio 傳輸模式啟動

- **GIVEN** 未設定任何傳輸模式配置
- **WHEN** 啟動 MCP Server
- **THEN** 系統使用 stdio 傳輸模式
- **AND** 系統行為與現有版本一致

#### Scenario: 使用環境變數指定 SSE 傳輸模式

- **GIVEN** 設定環境變數 `MCP_TRANSPORT=sse`
- **WHEN** 啟動 MCP Server
- **THEN** 系統使用 SSE 傳輸模式
- **AND** Web Server 啟動並提供 MCP SSE 端點

#### Scenario: 使用命令列參數指定傳輸模式

- **GIVEN** 使用命令 `user-web-feedback --transport sse`
- **WHEN** 系統啟動
- **THEN** 系統使用 SSE 傳輸模式
- **AND** 命令列參數優先於環境變數設定

#### Scenario: 使用 Streamable HTTP 傳輸模式

- **GIVEN** 設定環境變數 `MCP_TRANSPORT=streamable-http`
- **WHEN** 啟動 MCP Server
- **THEN** 系統使用 Streamable HTTP 傳輸模式
- **AND** Web Server 啟動並提供 MCP HTTP 端點

### Requirement: SSE 傳輸端點

系統 SHALL 在 SSE 傳輸模式下提供標準的 MCP SSE 端點。

#### Scenario: SSE 連線建立

- **GIVEN** MCP Server 以 SSE 模式運行在 port 3000
- **WHEN** MCP 客戶端向 `http://localhost:3000/mcp/sse` 發送 SSE 連線請求
- **THEN** 系統建立 SSE 連線
- **AND** 系統回應 Content-Type 為 `text/event-stream`

#### Scenario: SSE MCP 訊息傳輸

- **GIVEN** SSE 連線已建立
- **WHEN** MCP 客戶端向 `/mcp/message` 發送 POST 請求
- **THEN** 系統處理 MCP 訊息
- **AND** 透過 SSE 連線回應結果

### Requirement: Streamable HTTP 傳輸端點

系統 SHALL 在 Streamable HTTP 傳輸模式下提供標準的 MCP HTTP 端點。

#### Scenario: Streamable HTTP 連線建立

- **GIVEN** MCP Server 以 Streamable HTTP 模式運行在 port 3000
- **WHEN** MCP 客戶端向 `http://localhost:3000/mcp` 發送 POST 請求
- **THEN** 系統建立 Streamable HTTP 連線
- **AND** 系統支援雙向訊息傳輸

#### Scenario: 健康檢查包含傳輸模式資訊

- **GIVEN** MCP Server 正在運行
- **WHEN** 客戶端請求 `/health` 端點
- **THEN** 回應包含當前傳輸模式資訊
- **AND** 回應格式為 JSON

### Requirement: Docker 部署支援

系統 SHALL 提供適用於 Docker 部署的配置，預設使用 SSE 傳輸模式。

#### Scenario: Docker 容器預設使用 SSE 模式

- **GIVEN** 使用預設的 Dockerfile 構建映像
- **WHEN** 啟動 Docker 容器
- **THEN** MCP Server 以 SSE 模式運行
- **AND** 可透過映射的端口進行 HTTP 連線

#### Scenario: Docker Compose 部署

- **GIVEN** 使用 docker-compose.yml 部署
- **WHEN** 執行 `docker-compose up`
- **THEN** 系統正常啟動並接受 HTTP 連線
- **AND** 健康檢查正常運作

### Requirement: 文檔說明

系統 SHALL 在 README.md 中提供完整的 HTTP 連線配置說明。

#### Scenario: README 包含 HTTP MCP Server 配置

- **GIVEN** 使用者查閱 README.md
- **WHEN** 尋找 HTTP 連線配置方式
- **THEN** 可找到完整的配置範例
- **AND** 範例包含 Claude Desktop/Cursor 的 MCP 設定 JSON

#### Scenario: README 包含 Docker 部署說明

- **GIVEN** 使用者查閱 README.md
- **WHEN** 尋找 Docker 部署方式
- **THEN** 可找到 docker-compose 使用說明
- **AND** 說明包含如何連線到容器內的 MCP Server

