# Tasks: 更新多 IDE 實例支援（簡化版）

## 1. 核心實現

- [x] 1.1 更新端口衝突處理邏輯
  - 修改 `src/utils/port-manager.ts` 中的 `resolvePortConflict()` 方法
  - 當端口被佔用時，直接遞增到下一個可用端口
  - 設定最大嘗試次數（預設 20）
  - 返回實際使用的端口號

- [x] 1.2 簡化實例鎖定邏輯
  - 修改 `src/utils/instance-lock.ts`
  - 移除任何 IDE 識別相關代碼（如有）
  - 保持簡單的鎖定檔案機制
  - 鎖定檔案用於記錄運行中實例的 PID 和端口

- [x] 1.3 更新 CLI 啟動邏輯
  - 修改 `src/cli.ts` 中的啟動流程
  - 支援端口遞增啟動
  - 記錄並顯示實際使用的端口

## 2. 清理舊代碼

- [x] 2.1 移除 IDE 識別相關代碼
  - 移除 `getIDEIdentifier()` 函數（如存在）
  - 移除 `MCP_IDE_IDENTIFIER` 環境變數處理（如存在）
  - 移除基於 hash 的鎖定檔案命名（如存在）
  - 移除 `ideIdentifier` 欄位（如存在）
  - **結果：現有代碼中未發現 IDE 識別相關代碼，無需清理**

## 3. 測試驗證

- [x] 3.1 更新單元測試
  - 更新 `src/__tests__/port-manager.test.ts`
  - 新增 4 個測試案例（resolvePortConflict 和 findAlternativePort）
  - 測試端口遞增邏輯
  - 測試最大嘗試次數錯誤處理

- [x] 3.2 整合測試
  - ✅ 測試第一個實例正常啟動（端口 5050）
  - ✅ 測試第二個實例自動使用下一個端口（5051）
  - ✅ 確認多個實例可同時運行

## 4. 文檔更新

- [x] 4.1 更新 README.md
  - 新增多實例支援說明
  - 移除 `MCP_FORCE_PORT` 和 `MCP_KILL_PORT_PROCESS` 相關文檔
  - 說明端口遞增機制

## 實現摘要

### 主要變更

1. **`src/utils/port-manager.ts`**
   - `resolvePortConflict()`: 簡化為純端口可用性檢查 + 逃避策略
   - `findAlternativePort()`: 改為順序遞增（+1, +2, ...），最多 20 次嘗試

2. **`src/cli.ts`**
   - 移除 `InstanceLock.check()` 的早期返回邏輯
   - 使用 `PortManager.resolvePortConflict()` 獲取可用端口
   - 當端口遞增時顯示日誌

### 測試結果

- ✅ 199 個單元測試全部通過
- ✅ 多實例整合測試通過（5050, 5051, 5052, 5053 同時運行）
