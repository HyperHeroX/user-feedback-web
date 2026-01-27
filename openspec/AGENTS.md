# OpenSpec AI Agent Instructions

本文件定義 AI 助手在此專案中使用 OpenSpec 的規範。

## Overview

OpenSpec 是一個變更提案管理系統，用於：
- 規劃大型功能變更
- 記錄架構決策
- 追蹤實施任務
- 確保變更的可追溯性

## Directory Structure

```
openspec/
├── AGENTS.md          # 本文件
├── project.md         # 專案概述
├── specs/             # 現有規格（若有）
└── changes/           # 變更提案
    └── <change-id>/
        ├── proposal.md     # 提案概述
        ├── design.md       # 技術設計（可選）
        ├── tasks.md        # 任務清單
        └── specs/          # 規格變更
            └── <capability>/
                └── spec.md
```

## Proposal Workflow

### 1. 創建提案
使用 `/openspec-proposal` 命令或手動創建：
1. 選擇動詞開頭的 `change-id`（如 `add-feature`, `fix-bug`, `refactor-module`）
2. 填寫 `proposal.md` 說明變更目的和範圍
3. 填寫 `design.md` 說明技術實現（複雜變更必須）
4. 填寫 `tasks.md` 列出具體任務
5. 在 `specs/` 下定義規格變更

### 2. 審查提案
- 確認所有文件完整
- 驗證任務可執行性
- 檢查規格的場景覆蓋

### 3. 實施提案
使用 `/openspec-apply` 命令或按 `tasks.md` 逐步實施。

### 4. 歸檔提案
完成後使用 `/openspec-archive` 歸檔。

## Conventions

### Change ID 命名
- 使用動詞開頭：`add-`, `fix-`, `refactor-`, `update-`, `remove-`
- 使用小寫和連字符
- 簡潔描述變更內容

### 規格格式
```markdown
## ADDED|MODIFIED|REMOVED Requirements

### Requirement: <ID> - <Title>
描述...

#### Scenario: <場景名稱>
**Given** <前提條件>
**When** <操作>
**Then** <預期結果>
```

### 任務格式
```markdown
### T<number>: <Task Title>
- **File**: 相關文件
- **Action**: 具體動作
- **Verification**: 驗證方式
- **Dependencies**: 依賴任務
- **Parallelizable**: Yes/No
```

## Commands Reference

- `/openspec-proposal` - 創建新提案
- `/openspec-apply` - 實施提案
- `/openspec-archive` - 歸檔完成的提案

## Current Changes

| Change ID | Status | Summary |
|-----------|--------|---------|
| add-mcp-supervisor | In Progress | MCP Supervisor 架構 - 永遠存活的 MCP wrapper (T001-T011 完成) |
| add-ai-conversation-ui | Draft | AI 對話視窗 UI 改進 |
| add-terminal-cli-mode | Draft | 終端 CLI 模式支援 |
| add-conversation-image-preview | In Progress | 對話頁面圖片區塊預覽功能 (T001-T007 完成) |

## Archived Changes (2026-01-17)

| Change ID | Summary |
|-----------|---------|
| add-prompt-customization-ui | AI 提示詞自定義 + MCP 工具詳細列表 + 擴展 API 提供商 (NVIDIA, Z.AI) |
| add-self-probe-keepalive | 新增自我探查(Keep-Alive)功能 |
| add-prompt-aggregator-proxy | Prompt Aggregator 代理模式 |
| update-multi-ide-instance-support | 多 IDE 實例支援更新 |
