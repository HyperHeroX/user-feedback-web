# Proposal: add-ai-conversation-ui

## Status

**Draft** | Created: 2026-01-01

## Why

目前的 AI 回覆對話視窗 (`aiStreamingPanel`) 顯示方式較為簡陋，缺乏清晰的對話結構。使用者難以直觀地追蹤 AI 思考過程和工具執行流程。

本提案旨在：
1. 改進 AI 回覆視窗的視覺呈現，使用類似附件圖片中 Serena MCP 的對話式 UI
2. 實作工廠模式 (Factory Pattern)，根據設定自動選擇 API 或 CLI 模式
3. 統一手動 AI 回覆和自動 AI 回覆的介面體驗

## What Changes

### 前端 UI 改進

1. **對話視窗重構** (`aiStreamingPanel`)
   - 改用單向清單式顯示（非聊天氣泡）
   - 每個步驟使用可展開/收合的區塊 (`<details>`)
   - 顯示當前使用的模式標籤 (API/CLI)
   - 時間戳顯示

2. **步驟分類顯示**
   - 📤 **發送的提示詞** - 藍色主題
   - 🤔 **AI 思考中** - 灰色動畫
   - 🔧 **工具呼叫** - 橘色主題
   - 📋 **工具結果** - 紫色主題
   - ✅ **AI 回覆** - 綠色主題
   - ❌ **錯誤** - 紅色主題

### 後端工廠模式

1. **AIProviderFactory** (新增)
   - 統一介面 `IAIProvider`
   - `APIProvider` - 使用 Google Gemini API
   - `CLIProvider` - 使用 gemini/claude CLI
   - 根據 `cliSettings.aiMode` 自動選擇

2. **整合點**
   - 手動 AI 回覆按鈕
   - 自動 AI 回覆計時器觸發

## Scope

- **In scope:**
  - 前端 AI 回覆對話視窗 UI 重構
  - 後端工廠模式實作
  - 手動/自動 AI 回覆統一介面

- **Out of scope:**
  - 新的 AI 服務提供商整合
  - 對話歷史持久化
  - 多輪對話記憶

## Dependencies

- 無外部依賴
- 基於現有 `ai-service.ts` 和 `cli-executor.ts`

## Risks

1. **UI 相容性** - 需確保新 UI 在不同螢幕尺寸下正常顯示
2. **效能** - 大量對話內容可能影響滾動效能

## References

- 現有實作: `src/utils/ai-service.ts`
- 前端對話視窗: `src/static/modules/feedback-handler.js`
- CLI 執行器: `src/utils/cli-executor.ts`
