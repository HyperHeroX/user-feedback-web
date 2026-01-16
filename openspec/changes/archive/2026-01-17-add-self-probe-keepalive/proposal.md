# Proposal: Add Self-Probe (Keep-Alive) Feature

## Change ID
`add-self-probe-keepalive`

## Summary
新增自我探查（Keep-Alive）功能，確保 MCP 服務和 WebSocket 連接保持活躍狀態，防止因長時間閒置而被作業系統回收。同時進行系統穩定性審查，識別並修復可能導致服務中止的風險點。

## Problem Statement

### 1. 服務閒置風險
- MCP 工具長時間閒置可能被 OS 資源管理器回收
- WebSocket 連接在無活動時可能被中間代理（proxy/firewall）關閉
- 長時間無請求時，服務可能進入不健康狀態而不自知

### 2. 日誌誤解
用戶報告看到類似錯誤日誌：
```
[error] INFO serena.cli:start_mcp_server:282 - Starting MCP server
```
**澄清**: 這些是 Serena MCP Server 的 INFO 級別日誌，`[error]` 標籤是因為 Cursor IDE 將 stderr 輸出標記為 error。這不是真正的錯誤，是正常的啟動信息。

### 3. 系統中止風險點
經程式碼審查，識別以下潛在中止風險：
- `cli.ts`: 多處 `process.exit(1)` 在錯誤時直接退出
- `web-server.ts`: 優雅關閉邏輯中的異常處理
- 計時器清理不當可能導致資源洩漏
- Transport 連接斷開後的恢復機制

## Proposed Solution

### 1. Self-Probe (Keep-Alive) 功能
- **定期心跳**: 配置間隔執行內部健康檢查
- **WebSocket Ping/Pong**: 利用 Socket.IO 內建機制保持連接
- **MCP 通道探測**: 定期通過 MCP 發送輕量探測訊息
- **設定頁面控制**: 用戶可開關此功能並設定間隔

### 2. 穩定性增強
- 審查並優化所有 `process.exit` 調用
- 增強錯誤邊界和恢復機制
- 改進計時器生命週期管理
- 優化重連邏輯的健壯性

## Scope
- **In Scope**:
  - 新增 Self-Probe 配置項和後端邏輯
  - 設定頁面 UI 更新
  - 系統穩定性審查和修復
  - 單元測試覆蓋

- **Out of Scope**:
  - Serena MCP Server 的修改（第三方組件）
  - 外部網絡環境的連接問題

## Success Criteria
1. Self-Probe 可在設定頁面開關
2. 服務在長時間閒置後仍保持響應
3. WebSocket 連接在配置間隔內保持活躍
4. 系統中止風險點已識別並修復
5. 測試覆蓋率達標

## Related Capabilities
- `mcp-server`: MCP 伺服器核心
- `web-server`: Web 伺服器和 Socket.IO
- `session-storage`: 會話管理
- `settings-ui`: 設定頁面

## References
- [Socket.IO Ping/Pong](https://socket.io/docs/v4/how-it-works/#transports)
- [Node.js Process Events](https://nodejs.org/api/process.html#process-events)
