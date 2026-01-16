# Change: Update Multi-IDE Instance Support (Simplified)

## Why

當前系統使用全局鎖定檔案 (`.user-feedback.lock`) 確保單一實例運行。當多個不同的 IDE 實例（如 VSCode、Cursor、不同工作區）各自呼叫 user-feedback 時，第二個實例無法啟動。需要一個簡化的解決方案：當端口被佔用時，自動使用下一個可用端口啟動新實例，而非嘗試識別或終止現有實例。

## What Changes

- **MODIFIED**: 端口衝突處理策略從「識別並連接」改為「逃避並遞增」
- **MODIFIED**: 當目標端口被佔用時，自動遞增到下一個可用端口啟動新實例
- **REMOVED**: ~~IDE 實例識別機制（PPID、MCP_IDE_IDENTIFIER）~~
- **REMOVED**: ~~基於 IDE 識別的鎖定檔案命名（.user-feedback-{hash}.lock）~~
- **ADDED**: 簡化的端口遞增機制，不依賴實例識別

## Impact

- **Affected specs**: `multi-ide-instance` (簡化)
- **Affected code**:
  - `src/utils/port-manager.ts`: 更新端口衝突處理邏輯
  - `src/utils/instance-lock.ts`: 簡化實例檢測，移除 IDE 識別
  - `src/cli.ts`: 更新啟動邏輯以支援端口遞增
