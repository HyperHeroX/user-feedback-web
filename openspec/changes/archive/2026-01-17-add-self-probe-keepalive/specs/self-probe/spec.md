# Specification: Self-Probe (Keep-Alive) Capability

## Overview
Self-Probe 是一個可選功能，用於定期檢查服務狀態並保持連接活躍，防止因長時間閒置而被系統回收。

---

## ADDED Requirements

### Requirement: SP-001 - Self-Probe Configuration
系統應支援通過配置控制 Self-Probe 功能的啟用狀態和間隔時間。

**Properties**:
- 配置項 `enableSelfProbe`: boolean, 預設 `false`
- 配置項 `selfProbeIntervalSeconds`: number, 預設 `300`, 範圍 `60-600`
- 環境變數 `MCP_ENABLE_SELF_PROBE` 映射到 `enableSelfProbe`
- 環境變數 `MCP_SELF_PROBE_INTERVAL` 映射到 `selfProbeIntervalSeconds`

#### Scenario: 使用環境變數配置 Self-Probe
**Given** 環境變數 `MCP_ENABLE_SELF_PROBE=true` 和 `MCP_SELF_PROBE_INTERVAL=120`
**When** 服務啟動
**Then** Self-Probe 功能應啟用，間隔為 120 秒

#### Scenario: 預設配置
**Given** 未設定任何 Self-Probe 相關環境變數
**When** 服務啟動
**Then** Self-Probe 功能應停用（`enableSelfProbe=false`）

#### Scenario: 無效間隔值
**Given** 嘗試設定 `selfProbeIntervalSeconds=30`（低於最小值 60）
**When** 驗證配置
**Then** 應拒絕並使用預設值 300 秒，或報錯

---

### Requirement: SP-002 - Self-Probe Service Lifecycle
系統應管理 Self-Probe 服務的生命週期，包括啟動、停止和重新配置。

**Properties**:
- 服務隨 WebServer 啟動而啟動（若啟用）
- 服務隨 WebServer 停止而停止
- 配置變更時可動態重啟服務
- 停止時應正確清理所有計時器

#### Scenario: 服務啟動
**Given** `enableSelfProbe=true` 且 `selfProbeIntervalSeconds=300`
**When** WebServer 啟動
**Then** SelfProbeService 應啟動並按 300 秒間隔執行探查

#### Scenario: 服務停止
**Given** SelfProbeService 正在運行
**When** WebServer 停止
**Then** SelfProbeService 應停止，所有計時器應被清理

#### Scenario: 動態配置變更
**Given** SelfProbeService 以 300 秒間隔運行
**When** 用戶通過 API 將間隔改為 120 秒
**Then** 服務應重啟並以 120 秒間隔運行

---

### Requirement: SP-003 - Self-Probe Execution
Self-Probe 執行時應進行必要的健康檢查操作。

**Properties**:
- 檢查 Socket.IO 連接狀態
- 檢查 MCP Server 狀態
- 觸發過期會話清理
- 記錄探查結果（debug 級別）
- 單次探查應在 10ms 內完成

#### Scenario: 正常探查
**Given** SelfProbeService 正在運行
**When** 到達探查間隔
**Then** 應執行健康檢查並記錄結果

#### Scenario: 探查失敗處理
**Given** SelfProbeService 正在運行
**When** 探查過程中發生錯誤
**Then** 應記錄警告但不中止服務，下次探查應繼續執行

---

### Requirement: SP-004 - Settings API
系統應提供 API 端點用於獲取和更新 Self-Probe 設定。

**Properties**:
- `GET /api/settings/self-probe` 返回當前設定
- `POST /api/settings/self-probe` 更新設定
- 更新後立即生效

#### Scenario: 獲取設定
**Given** Self-Probe 設定為 `enabled=true, intervalSeconds=180`
**When** 發送 `GET /api/settings/self-probe`
**Then** 應返回 `{ enabled: true, intervalSeconds: 180 }`

#### Scenario: 更新設定
**Given** Self-Probe 當前停用
**When** 發送 `POST /api/settings/self-probe` 帶 `{ enabled: true, intervalSeconds: 120 }`
**Then** 應返回成功，且 Self-Probe 應以 120 秒間隔啟動

#### Scenario: 無效設定
**Given** 任意 Self-Probe 狀態
**When** 發送 `POST /api/settings/self-probe` 帶 `{ intervalSeconds: 10 }`（無效值）
**Then** 應返回 400 錯誤，設定不應變更

---

### Requirement: SP-005 - Settings UI
設定頁面應提供 Self-Probe 功能的控制介面。

**Properties**:
- 開關控制啟用/停用
- 數字輸入控制間隔（限制 60-600）
- 儲存按鈕觸發 API 調用
- 頁面載入時顯示當前設定

#### Scenario: 頁面載入
**Given** Self-Probe 設定為 `enabled=true, intervalSeconds=300`
**When** 用戶打開設定頁面
**Then** 開關應為開啟狀態，間隔輸入應顯示 300

#### Scenario: 儲存設定
**Given** 用戶修改 Self-Probe 設定
**When** 點擊儲存按鈕
**Then** 應調用 API 並顯示成功提示

---

### Requirement: SP-006 - Health Status Extension
健康狀態 API 應包含 Self-Probe 相關資訊。

**Properties**:
- `/api/health` 應包含 `selfProbe` 欄位
- 包含 `enabled`, `isRunning`, `lastProbeTime`, `probeCount`

#### Scenario: 健康狀態查詢
**Given** SelfProbeService 已執行 5 次探查
**When** 發送 `GET /api/health`
**Then** 回應應包含 `selfProbe: { enabled: true, isRunning: true, probeCount: 5, lastProbeTime: "..." }`

---

## MODIFIED Requirements

### Requirement: WS-SHUTDOWN - WebServer Graceful Shutdown (Modified)
修改優雅關閉邏輯以包含 SelfProbeService 停止。

#### Scenario: 優雅關閉包含 Self-Probe
**Given** WebServer 和 SelfProbeService 正在運行
**When** 收到 SIGINT 信號
**Then** SelfProbeService 應在 WebServer 關閉前停止

---

## Constraints

1. **效能**: 單次探查不應超過 10ms
2. **資源**: 探查不應產生外部網絡請求
3. **日誌**: 正常探查使用 debug 級別，異常使用 warn 級別
4. **向後相容**: 預設停用，不影響現有部署
