# Specification: MCP Supervisor

## ADDED Requirements

### Requirement: SUP-001 - Supervisor Process

Supervisor 作為長期存活的進程，維持與 Cursor IDE 的 MCP 連線。

#### Scenario: Supervisor 啟動
**Given** 系統以 supervisor 模式啟動
**When** 執行 `npm start` 或 `npx user-feedback start`
**Then** Supervisor 進程啟動
**And** Supervisor 自動 spawn Worker 進程
**And** Supervisor 等待 Worker 發送 'ready' 訊號
**And** MCP Transport 連線建立完成

#### Scenario: Worker 崩潰自動重啟
**Given** Supervisor 正在運行
**And** Worker 進程意外終止
**When** Supervisor 偵測到 Worker 終止
**Then** Supervisor 記錄崩潰事件
**And** Supervisor 在設定的延遲後（預設 2 秒）重啟 Worker
**And** 重啟計數增加
**And** MCP 連線保持不中斷

#### Scenario: 達到最大重啟次數
**Given** Worker 已重啟達到最大次數（預設 5 次）
**When** Worker 再次崩潰
**Then** Supervisor 不再嘗試重啟
**And** Supervisor 記錄致命錯誤
**And** 通過 MCP 回報錯誤狀態
**And** MCP 連線仍然保持

---

### Requirement: SUP-002 - Health Monitoring

Supervisor 定期檢查 Worker 健康狀態。

#### Scenario: 健康檢查成功
**Given** Worker 正在運行
**When** 健康檢查週期到達（預設每 30 秒）
**Then** Supervisor 通過 IPC 發送健康檢查請求
**And** Worker 在超時時間內（預設 5 秒）回應
**And** 健康狀態更新為 'healthy'

#### Scenario: 健康檢查失敗
**Given** Worker 正在運行但無回應
**When** 健康檢查請求超時
**Then** Supervisor 標記 Worker 為 'unhealthy'
**And** 連續 3 次失敗後觸發 Worker 重啟

---

### Requirement: SUP-003 - MCP Tool: self_test (Unified Self-Diagnosis & Auto-Repair)

AI 助手可以通過 `self_test` 工具執行系統健康檢查，並在必要時自動修復問題。

#### Scenario: 執行 self_test（所有組件健康）
**Given** MCP 連線已建立
**And** 所有組件正常運行
**When** AI 呼叫 `self_test` 工具
**Then** 系統執行以下檢查：
  - Supervisor 狀態
  - Worker 狀態
  - Web Server 狀態
  - Database 連線狀態
**And** 返回 SelfTestResult 物件
**And** health.worker.status = 'ok'
**And** autoRepair 為 undefined
**And** summary 表明系統正常

#### Scenario: Worker 失效時自動重啟
**Given** Worker 進程未運行或不健康
**When** AI 呼叫 `self_test` 工具
**Then** 系統偵測到 Worker 問題
**And** 系統自動重啟 Worker
**And** 等待 Worker 完成啟動
**And** 返回 SelfTestResult 物件
**And** health.worker.status = 'restarted'
**And** autoRepair.action = 'worker_restarted'
**And** autoRepair 包含 previousPid, newPid, reason
**And** summary 說明已執行自動修復

#### Scenario: Worker 重啟失敗
**Given** Worker 進程無法啟動
**When** AI 呼叫 `self_test` 工具
**Then** 系統嘗試重啟 Worker
**And** 重啟失敗
**And** 返回 SelfTestResult 物件
**And** health.worker.status = 'failed'
**And** summary 說明修復失敗，需要人工介入

#### Scenario: 獲取完整診斷資訊
**Given** Supervisor 正在運行
**When** AI 呼叫 `self_test` 工具
**Then** diagnostics 包含：
  - system.platform: 作業系統平台
  - system.nodeVersion: Node.js 版本
  - system.totalMemory: 總記憶體
  - system.freeMemory: 可用記憶體
  - restartHistory: 重啟歷史記錄陣列

---

### Requirement: SUP-004 - IPC Communication

Supervisor 和 Worker 通過 IPC（stdio streams）進行通訊。

#### Scenario: MCP 請求代理
**Given** Worker 正在運行
**When** Cursor 發送 MCP 工具請求（如 collect_feedback）
**Then** Supervisor 接收請求
**And** Supervisor 通過 IPC 轉發給 Worker
**And** Worker 執行工具邏輯
**And** Worker 返回結果給 Supervisor
**And** Supervisor 將結果返回給 Cursor

#### Scenario: Worker 重啟期間的請求處理
**Given** Worker 正在重啟中
**When** Cursor 發送 MCP 工具請求
**Then** Supervisor 將請求放入佇列
**And** Worker 重啟完成後
**And** Supervisor 從佇列取出請求轉發
**And** 請求正常完成

#### Scenario: 請求超時
**Given** Worker 正在重啟中
**And** 請求在佇列中超過 30 秒
**When** 超時到達
**Then** Supervisor 返回錯誤回應
**And** 錯誤訊息說明 Worker 暫時不可用

---

### Requirement: SUP-005 - Configuration

Supervisor 功能可通過配置控制。

#### Scenario: 啟用 Supervisor 模式
**Given** 環境變數 SUPERVISOR_ENABLED=true
**When** 系統啟動
**Then** 系統以 Supervisor 模式運行

#### Scenario: 禁用 Supervisor 模式
**Given** 命令列參數 --no-supervisor
**When** 系統啟動
**Then** 系統以傳統模式運行（直接啟動 MCP Server）

#### Scenario: 配置驗證
**Given** SUPERVISOR_MAX_RESTART_ATTEMPTS=-1
**When** 系統啟動
**Then** 配置驗證失敗
**And** 使用預設值 5

---

## MODIFIED Requirements

### Requirement: CLI-START - CLI Start Command

（原有）CLI 啟動命令現在支持 Supervisor 模式。

#### Scenario: 預設啟動（Phase 1）
**Given** 未提供任何選項
**When** 執行 `npm start`
**Then** 系統以傳統模式啟動（向後相容）

#### Scenario: 預設啟動（Phase 2+）
**Given** 未提供任何選項
**And** SUPERVISOR_ENABLED 未設定或為 true
**When** 執行 `npm start`
**Then** 系統以 Supervisor 模式啟動

---

### Requirement: HEALTH-API - Health API Extension

Health API 需要支持 Supervisor 狀態。

#### Scenario: Supervisor 模式下的健康檢查
**Given** 系統以 Supervisor 模式運行
**When** 呼叫 GET /api/health
**Then** 返回包含以下額外資訊：
  - supervisor.enabled: true
  - supervisor.pid: number
  - supervisor.workerStatus: string
  - supervisor.restartCount: number
