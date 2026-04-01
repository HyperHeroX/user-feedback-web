# response-delivery Specification

## Purpose

確保用戶回饋回應能可靠地送達 MCP Client，即使 Transport 層斷線或不穩定。

## ADDED Requirements

### Requirement: RD-001 — 回應持久化存儲

系統 SHALL 在用戶提交回饋後立即將回應寫入 SQLite 持久化存儲，確保回應不因 Transport 斷線或伺服器重啟而遺失。

#### Scenario: 正常提交時回應被持久化

- **Given** 用戶在 Web UI 存在一個活躍的 feedback session
- **When** 用戶提交回饋
- **Then** 系統在呼叫 `session.resolve()` 前將回應寫入 `pending_responses` 表
- **And** 記錄包含 session_id、project_id、feedback 內容、建立時間、過期時間

#### Scenario: Transport 斷線時回應安全保存

- **Given** MCP Transport 已斷線（stdio pipe 斷裂或 HTTP 連線關閉）
- **When** 用戶提交回饋
- **Then** 系統將回應持久化至 DB
- **And** 回應標記為 `delivered = false`
- **And** Web UI 顯示「提交成功」（用戶體驗不受影響）

#### Scenario: 過期回應自動清理

- **Given** 一筆 pending_response 已超過 TTL（預設 24 小時）
- **When** 系統執行定期清理
- **Then** 該記錄被從 DB 移除

---

### Requirement: RD-002 — collect_feedback 優先回傳未送達回應

系統 SHALL 在收到 `collect_feedback` 呼叫時，優先檢查是否存在同專案的未送達回應，若有則直接回傳而非建立新 session。

#### Scenario: 存在未送達回應時直接回傳

- **Given** 專案 "MyProject" 有一筆未送達的 pending_response
- **When** MCP Client 再次呼叫 `collect_feedback`（project_name="MyProject"）
- **Then** 系統直接回傳該未送達回應
- **And** 標記該回應為 `delivered = true`
- **And** 不建立新的 feedback session

#### Scenario: 無未送達回應時走正常流程

- **Given** 專案 "MyProject" 無任何未送達的 pending_response
- **When** MCP Client 呼叫 `collect_feedback`
- **Then** 系統走正常的建立 session + 等待用戶回饋流程

---

### Requirement: RD-003 — Transport 健康偵測

系統 SHALL 能偵測所有 Transport 模式（stdio、SSE、streamable-http）的連線健康狀態。

#### Scenario: stdio 心跳偵測正常

- **Given** MCP Server 以 stdio 模式運行
- **When** 系統每 30 秒發送一次 notification ping
- **Then** 若 ping 成功，Transport 標記為 healthy

#### Scenario: stdio 心跳偵測失敗

- **Given** MCP Server 以 stdio 模式運行且 stdio pipe 已斷裂
- **When** 系統嘗試發送 notification ping
- **Then** ping 拋出異常
- **And** Transport 標記為 unhealthy
- **And** 後續回應將僅保存至 DB 等待重連

#### Scenario: HTTP Transport 健康偵測（已有機制增強）

- **Given** MCP Server 以 streamable-http 模式運行
- **When** SSE 通道關閉
- **Then** `isTransportHealthy()` 回傳 false
- **And** 行為與 stdio unhealthy 一致

---

### Requirement: RD-004 — 輪詢 API 端點

系統 SHALL 提供 REST API 端點，供 MCP Client 或人工操作查詢並確認未送達回應。

#### Scenario: 查詢未送達回應

- **Given** 專案 "proj-123" 有一筆未送達回應
- **When** 客戶端發送 `GET /api/pending-response/proj-123`
- **Then** 系統回傳該未送達回應內容
- **And** HTTP 狀態碼 200

#### Scenario: 無未送達回應

- **Given** 專案 "proj-123" 無任何未送達回應
- **When** 客戶端發送 `GET /api/pending-response/proj-123`
- **Then** 系統回傳空結果
- **And** HTTP 狀態碼 200

#### Scenario: 確認送達

- **Given** 存在 id 為 "resp-001" 的未送達回應
- **When** 客戶端發送 `POST /api/pending-response/resp-001/ack`
- **Then** 系統將該回應標記為 `delivered = true`
- **And** HTTP 狀態碼 200

## MODIFIED Requirements

### Requirement: MOD-001 — pendingDeliveryCache 降級為輔助角色

現有的 in-memory `pendingDeliveryCache`（60 秒快取）SHALL 作為 DB 持久化的快速路徑輔助，而非唯一的回應恢復機制。

#### Scenario: 快取命中時直接回傳（快速路徑）

- **Given** `pendingDeliveryCache` 中有尚未過期的回應
- **When** collect_feedback 被重新呼叫
- **Then** 直接從快取回傳（跳過 DB 查詢）
- **And** 同時標記 DB 中的記錄為 delivered

#### Scenario: 快取未命中時回退至 DB

- **Given** `pendingDeliveryCache` 中無匹配記錄
- **When** collect_feedback 被重新呼叫
- **Then** 系統查詢 DB 中的未送達回應
- **And** 若找到則回傳並標記 delivered

## Cross-references

- **http-mcp-transport**: Transport 模式選擇規格（SSE/Streamable HTTP）
- **deferred-mcp-startup**: 延遲啟動機制
