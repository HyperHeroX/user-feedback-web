## ADDED Requirements

### Requirement: Port Evasion Strategy
當目標端口被佔用時，系統 SHALL 自動遞增到下一個可用端口，而非嘗試終止或連接現有實例。

#### Scenario: First instance starts normally
- **GIVEN** 端口 5050 未被佔用
- **WHEN** 第一個 user-feedback 實例啟動
- **THEN** 系統 SHALL 在端口 5050 啟動服務
- **AND** 日誌 SHALL 顯示 "Server started on port 5050"

#### Scenario: Second instance uses next available port
- **GIVEN** 第一個實例已在端口 5050 運行
- **WHEN** 第二個 user-feedback 實例啟動
- **THEN** 系統 SHALL 檢測到端口 5050 被佔用
- **AND** 系統 SHALL 自動在端口 5051 啟動新實例
- **AND** 第一個實例 SHALL 不受影響繼續運行
- **AND** 日誌 SHALL 顯示 "Port 5050 in use, trying port 5051"

#### Scenario: Multiple instances on consecutive ports
- **GIVEN** 端口 5050 和 5051 均被佔用
- **WHEN** 第三個 user-feedback 實例啟動
- **THEN** 系統 SHALL 嘗試端口 5050, 5051, 5052
- **AND** 系統 SHALL 在端口 5052 啟動服務
- **AND** 日誌 SHALL 顯示端口遞增過程

### Requirement: Maximum Port Retry Limit
系統 SHALL 設定端口遞增的最大嘗試次數以防止無限循環。

#### Scenario: Exceed maximum retry attempts
- **GIVEN** 端口 5050 至 5059 均被佔用
- **AND** 最大嘗試次數設為 10
- **WHEN** 新的 user-feedback 實例啟動
- **THEN** 系統 SHALL 嘗試 10 個端口後停止
- **AND** 系統 SHALL 返回錯誤 "Could not find available port after 10 attempts"
- **AND** 系統 SHALL 不啟動服務

### Requirement: Preserve Existing Instances
系統 SHALL 不嘗試終止、替換或干擾任何現有運行中的實例。

#### Scenario: Do not kill existing process on port conflict
- **GIVEN** 另一個進程正在使用端口 5050
- **WHEN** user-feedback 實例嘗試啟動
- **THEN** 系統 SHALL 不嘗試終止該進程
- **AND** 系統 SHALL 直接嘗試下一個端口
- **AND** 現有進程 SHALL 不受任何影響

### Requirement: Stale Lock File Cleanup
當鎖定檔案存在但對應進程已終止時，系統 SHALL 清理過期的鎖定檔案。

#### Scenario: Cleanup stale lock file on startup
- **GIVEN** 鎖定檔案存在且記錄 PID=12345
- **AND** PID 12345 的進程已不存在
- **WHEN** 新的 user-feedback 實例啟動
- **THEN** 系統 SHALL 檢測到鎖定檔案已過期
- **AND** 系統 SHALL 清理該鎖定檔案
- **AND** 系統 SHALL 正常啟動服務

## REMOVED Requirements

### Requirement: IDE Instance Isolation
**Reason**: 移除 IDE 實例識別機制，簡化為純端口逃避策略
**Migration**: 不再區分 IDE 實例，所有實例平等對待

### Requirement: IDE Identifier Generation
**Reason**: 移除 PPID 和 MCP_IDE_IDENTIFIER 相關邏輯
**Migration**: 不再使用環境變數識別 IDE

### Requirement: Lock File Per IDE Instance
**Reason**: 移除基於 IDE hash 的鎖定檔案命名
**Migration**: 使用單一全局鎖定檔案
