# Change: Add Prompt Aggregator Proxy

## Why
目前提示詞構建邏輯分散在多個檔案中（`ai-service.ts`、`api-provider.ts`、`cli-provider.ts`），導致重複程式碼和難以維護。需要建立一個統一的「Prompt Aggregator Proxy」來整合所有提示詞的組合、預覽和紀錄，實現低耦合高內聚的設計原則。

## What Changes
- **新增 Prompt Aggregator Proxy**: 建立 `PromptAggregator` 類別，統一管理所有提示詞的組合邏輯
- **重構 Provider 模式**: 修改 `APIProvider` 和 `CLIProvider` 使用統一的 Prompt Aggregator
- **新增提示詞預覽功能**: 整合預覽與實際使用同一個 Proxy
- **CLI MCP 回應處理**: CLI 模式下根據 AI 回應決定是否呼叫 MCP Server，並將結果作為新提示詞送回終端機
- **設定整合**: 使用者可在設定中選擇 CLI 或 API 模式（擴展現有功能）

## Impact
- Affected specs: `cli-execution`, `cli-settings`
- Affected code:
  - `src/utils/prompt-aggregator.ts` (新增)
  - `src/utils/api-provider.ts` (重構)
  - `src/utils/cli-provider.ts` (重構)
  - `src/utils/ai-service.ts` (移除重複邏輯)
  - `src/utils/ai-provider-factory.ts` (整合 Proxy)
  - `src/types/ai-provider.ts` (新增型別)

## Success Criteria
1. 所有提示詞構建邏輯集中在 `PromptAggregator`
2. `getPromptPreview()` 和實際 AI 請求使用相同的 Proxy
3. CLI 模式可正確處理 MCP 工具呼叫並回送結果
4. 現有的 API 模式功能不受影響
5. 單元測試覆蓋新功能
6. 瀏覽器 E2E 測試通過

## Related Changes
- Extends `add-terminal-cli-mode` (CLI 模式基礎架構)
