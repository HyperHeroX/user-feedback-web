# Proposal: AI 回覆提示詞自定義系統

## Problem Statement

目前 AI 回覆使用的提示詞流程是硬編碼的，用戶無法：
- 自定義提示詞的順序
- 控制哪些提示詞在第一次/後續呼叫中使用
- 編輯現有的提示詞內容
- 控制是否包含 MCP 工具描述

此外，API 提供商選項不足，缺少 NVIDIA 和 Z.AI (Zhipu AI) 的支援。

## Proposed Solution

### 1. AI 回覆提示詞管理頁面

在設定頁面新增「提示詞設定」區塊，提供：

#### 提示詞列表管理
- 顯示所有可用的提示詞組件（系統提示詞、MCP 工具說明、用戶上下文等）
- 每個提示詞顯示：
  - 名稱
  - 內容預覽（可展開編輯）
  - **第一次順序欄位** - 控制首次 AI 呼叫時的順序
  - **第二次順序欄位** - 控制後續 AI 呼叫時的順序
  - **啟用/停用勾選框** - 控制是否使用該提示詞

#### MCP 工具描述選項
- 新增「包含 MCP 工具描述」開關
- 可編輯 MCP 工具描述的格式模板

#### 工作流程
1. 第一次 AI 呼叫：按「第一次順序」排列所有已啟用的提示詞
2. 後續 AI 呼叫：按「第二次順序」排列所有已啟用的提示詞
3. 所有變更即時儲存到資料庫

### 2. 新增 API 提供商

#### NVIDIA API 設定
- 提供商名稱：NVIDIA
- API 類型：Custom (OpenAI-compatible)
- 預設 Endpoint：`https://integrate.api.nvidia.com/v1`
- 需要自定義 API Key
- 支援模型選擇

#### Z.AI (Zhipu AI) API 設定
- 提供商名稱：Z.AI / Zhipu AI
- 國際版 Endpoint：`https://api.z.ai/api/paas/v4`
- 中國版 Endpoint：`https://open.bigmodel.cn/api/paas/v4`
- 認證方式：Bearer Token
- 支援模型：GLM 系列

## Scope

### In Scope
- 提示詞管理 UI（設定頁面）
- 提示詞順序資料表結構
- 後端 API 端點
- NVIDIA API 提供商整合
- Z.AI API 提供商整合
- 單元測試與整合測試

### Out of Scope
- 提示詞模板市場
- 多語言提示詞
- AI 自動優化提示詞

## Success Criteria

1. 用戶可以在設定頁面管理所有提示詞的順序和狀態
2. 第一次/後續呼叫使用不同的提示詞順序
3. 所有提示詞可編輯並持久化
4. NVIDIA API 可正常使用
5. Z.AI API 可正常使用（國際版和中國版）
6. 所有現有測試通過
7. 新增測試覆蓋新功能

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 提示詞順序改變影響 AI 回覆質量 | Medium | 提供「恢復預設」按鈕 |
| API 提供商相容性問題 | Medium | 使用 OpenAI-compatible 模式，添加錯誤處理 |
| 資料庫遷移問題 | Low | 使用向後相容的 schema 設計 |

## Dependencies

- 現有的 `PromptAggregator` 系統
- 現有的 API Provider 工廠模式
- SQLite 資料庫

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Database Schema | Small |
| Backend API | Medium |
| UI Implementation | Large |
| API Providers | Medium |
| Testing | Medium |
| **Total** | **~20-25 hours** |
