# Startup Optimization Specification

## ADDED Requirements

### Requirement: Lazy Module Loading

系統 SHALL 支援延遲載入非核心模組，以減少啟動時間和記憶體使用量。

#### Scenario: Image Processor Lazy Load
- **WHEN** MCP Server 啟動
- **AND** 沒有圖片處理請求
- **THEN** Jimp 模組不應被載入
- **AND** 記憶體使用量應低於完整載入模式

#### Scenario: Image Processor On-Demand Load
- **WHEN** 收到圖片處理請求（如 /api/convert-images）
- **THEN** 系統應動態載入 ImageProcessor
- **AND** 後續請求應重用已載入的實例

#### Scenario: Jimp Not Available Graceful Degradation
- **WHEN** Jimp 模組無法載入（如 optional dependency 未安裝）
- **AND** 收到圖片處理請求
- **THEN** 系統應返回明確的錯誤訊息
- **AND** 其他功能應正常運作

### Requirement: Database Lazy Initialization

系統 SHALL 支援延遲初始化資料庫，直到首次需要時才建立連線。

#### Scenario: Stdio Mode Without Database
- **WHEN** MCP Server 以 stdio 模式啟動
- **AND** 沒有任何需要資料庫的操作
- **THEN** 資料庫不應被初始化

#### Scenario: Database Auto-Initialize On Access
- **WHEN** 首次存取需要資料庫的 API（如 /api/prompts）
- **THEN** 系統應自動初始化資料庫
- **AND** 後續請求應使用已初始化的連線

### Requirement: Static Assets Path Resolution

系統 SHALL 正確解析靜態資源路徑，支援多種執行環境。

#### Scenario: Bundled Mode Static Assets
- **WHEN** 透過 `npx` 或打包後的單檔執行
- **AND** 請求存取靜態資源（如 index.html）
- **THEN** 系統應正確定位 dist/static 目錄
- **AND** 返回 HTTP 200 回應

#### Scenario: Development Mode Static Assets
- **WHEN** 透過 `tsx` 或開發模式執行
- **AND** 請求存取靜態資源
- **THEN** 系統應正確定位 src/static 目錄

#### Scenario: Static Assets Not Found Logging
- **WHEN** 所有候選路徑都不存在靜態資源
- **THEN** 系統應記錄所有嘗試過的路徑
- **AND** 返回適當的錯誤訊息
