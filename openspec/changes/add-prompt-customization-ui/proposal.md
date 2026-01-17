# Proposal: add-prompt-customization-ui

## Summary

新增 AI 提示詞自定義 UI 和擴展 API 提供商支援（NVIDIA、Z.AI）。

## Problem Statement

1. 用戶無法自定義 AI 回覆時使用的提示詞順序
2. 系統只支援 Google Gemini API，缺乏其他 AI 提供商選項
3. 無法針對首次呼叫和後續呼叫使用不同的提示詞配置

## Proposed Solution

### 1. 提示詞自定義系統

- 資料庫新增 `prompt_configs` 表儲存配置
- 支援設定第一次/第二次呼叫的順序
- 支援啟用/停用個別提示詞組件
- 提供 API 端點管理配置
- 設定頁面新增 UI 區塊

### 2. 擴展 API 提供商

- 新增 NVIDIA API 支援 (OpenAI-compatible)
- 新增 Z.AI (智譜 AI) 支援 (國際版/中國版)
- 設定頁面新增提供商配置 UI

## Scope

### In Scope

- 後端: 資料庫 Schema, API 端點, Provider 類別
- 前端: 設定頁面 UI 區塊
- 文檔: 配置說明更新

### Out of Scope

- 提示詞內容編輯功能（僅順序和啟用狀態）
- API 連接測試功能（待後續實現）

## Success Criteria

1. 用戶可在設定頁面調整提示詞順序
2. 系統正確根據 isFirstCall 使用對應順序
3. NVIDIA/Z.AI 設定可正確保存和載入
4. 所有測試通過，無構建錯誤

## Risks

| Risk | Mitigation |
|------|------------|
| 資料庫 Schema 變更 | 使用 IF NOT EXISTS 確保兼容 |
| API 提供商差異 | 使用 OpenAI-compatible 基類 |

## Dependencies

- 現有 PromptAggregator 模組
- 現有 AI Provider Factory
