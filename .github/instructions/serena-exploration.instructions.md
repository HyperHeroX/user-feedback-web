---
name: serena-code-exploration
description: 強制使用 Serena MCP 工具進行原始碼探索和分析
applyTo: "**/*.{ts,js,tsx,jsx,py,cs,java}"
---

# Serena MCP 原始碼探索指令

## 必須遵守

- **所有源代碼探索和分析必須優先使用 Serena MCP 工具箱**
- **僅當 Serena MCP 無相關可用工具時，才可嘗試其他工具**

## 工具優先順序

1. 使用 `get_symbols_overview` 獲取檔案結構概覽
2. 使用 `find_symbol` 進行精確的符號查詢
3. 使用 `search_for_pattern` 進行模式搜尋
4. 使用 `find_referencing_symbols` 查找符號引用

## 禁止行為

- ❌ 不要直接讀取完整檔案（除非絕對必要）
- ❌ 不要使用通用搜尋工具取代 Serena 符號工具
- ❌ 不要跳過符號分析直接修改程式碼
