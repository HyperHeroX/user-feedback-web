# Proposal: Enhanced Feedback Interface with AI Integration

## Why

當前的 MCP Feedback Collector 提供基本的反饋收集功能，但在複雜的 AI 互動場景中存在以下問題：

1. **UI 限制**: 單一欄位的介面無法同時顯示 AI 訊息和使用者輸入，導致互動體驗不佳
2. **缺乏提示詞管理**: 使用者需要重複輸入常用的回應內容，效率低下
3. **無 AI 輔助**: 使用者完全手動回應，無法利用 AI 協助生成回覆
4. **無持久化**: 所有設定和提示詞在關閉後遺失，無法保留使用習慣
5. **超時處理簡單**: 當使用者長時間未回應時，只能等待超時或手動關閉

這些限制降低了工具在生產環境中的實用性，特別是在需要頻繁互動和快速回應的場景中。

## What Changes

### 1. UI 重構為三欄式佈局

- **左側 (30%)**: AI 訊息顯示區
  - 支援 Markdown 渲染
  - 顯示 AI 的工作匯報或問題
  - 可捲動查看歷史訊息
  
- **中間 (40%)**: 使用者互動區
  - **上方 (60%)**: 文字回應輸入區
    - 支援 Ctrl+Enter 快速提交
    - 支援空白回應（跳過）
    - 整合 AI 回覆按鈕
  - **下方 (40%)**: 圖片上傳/貼上區
    - 維持現有的圖片處理功能
  
- **右側 (30%)**: 提示詞管理區
  - 提示詞列表（可搜尋）
  - 點擊複製到輸入區
  - 釘選功能（啟動時自動載入）
  - CRUD 操作
  - AI 設定按鈕

### 2. 提示詞管理系統

- 提示詞 CRUD 操作
- 釘選優先顯示
- 啟動時自動載入釘選提示詞（按順序）
- 分類/標籤系統（可選）

### 3. AI 輔助回覆功能

- 整合 Gemini 2.5 Flash API
- 可配置的 AI 設定：
  - API URL 路徑
  - 模型名稱
  - API Key（加密儲存）
  - 系統提示詞
- AI 回覆按鈕：將 AI 訊息內容發送給 Gemini，生成建議回覆

### 4. 資料持久化

- 提示詞資料庫（SQLite）
- AI 設定儲存
- API Key 加密儲存（使用 Node.js crypto）
- 使用者偏好設定

### 5. 自動 AI 回應機制

- 300 秒（5 分鐘）無活動計時器
- 倒數提示（最後 60 秒）
- 超時自動觸發 AI 生成回應
- 可在設定中調整超時時間

## Impact

### Affected Specs

- **feedback-ui** (NEW): 新的三欄式使用者介面規格
- **prompt-management** (NEW): 提示詞管理系統規格
- **ai-integration** (NEW): AI 輔助回覆整合規格
- **data-persistence** (NEW): 資料持久化和安全儲存規格

### Affected Code

#### 前端
- `src/static/index.html` - 完全重構為三欄式佈局
- `src/static/style.css` - 新增響應式三欄佈局樣式
- `src/static/app.js` - 新增：
  - Markdown 渲染（使用 marked.js）
  - 提示詞管理 UI 邏輯
  - AI 回覆整合
  - 自動回應計時器
  - 持久化資料同步

#### 後端
- `src/server/web-server.ts` - 新增 API 端點：
  - `/api/prompts` (CRUD)
  - `/api/ai-settings` (CRUD)
  - `/api/ai-reply` (AI 回覆生成)
- `src/utils/` - 新增工具模組：
  - `database.ts` - SQLite 資料庫管理
  - `crypto-helper.ts` - API Key 加密/解密
  - `ai-service.ts` - Gemini API 整合
- `src/types/index.ts` - 新增類型定義：
  - `Prompt`, `AISettings`, `AIReplyRequest`
- `src/config/index.ts` - 新增設定選項：
  - `enableAutoAIReply`, `autoReplyTimeout`

#### 資料庫
- 新增 SQLite 資料庫（`data/feedback.db`）
- 資料表：
  - `prompts` - 提示詞
  - `ai_settings` - AI 設定
  - `user_preferences` - 使用者偏好

#### 依賴
- 新增 NPM 套件：
  - `marked` - Markdown 渲染
  - `better-sqlite3` - SQLite 資料庫
  - `@google/generative-ai` - Gemini API 客戶端

### Breaking Changes

**BREAKING**: 前端 UI 完全重構，需要更新所有依賴此介面的整合代碼。

**Migration Path**: 
- 現有的反饋提交 API 保持向後相容
- 新的三欄式介面為預設，舊版可通過 `?legacy=true` 參數存取
- 提供 3 個月的過渡期，之後移除舊版介面

### User Benefits

1. **更高效的互動**: 同時查看 AI 訊息和撰寫回應
2. **節省時間**: 提示詞快速複製，釘選功能自動載入常用內容
3. **AI 輔助**: 利用 AI 生成建議回覆，提高回應品質
4. **個人化**: 持久化的設定和提示詞，符合個人使用習慣
5. **自動化**: 超時自動 AI 回應，無需人工監控

### Risks

1. **複雜度增加**: 三欄式佈局在小螢幕設備上可能不適用（需要響應式設計）
2. **資料安全**: API Key 儲存需要妥善的加密機制
3. **效能影響**: Markdown 渲染和 AI API 呼叫可能增加延遲
4. **依賴外部服務**: Gemini API 的可用性和費用
5. **向後相容**: 現有整合可能需要適配新介面

### Mitigation

1. 實作響應式設計，在行動裝置上切換為單欄模式
2. 使用 Node.js crypto 模組進行 AES-256 加密
3. 實作 AI 回覆的快取和重試機制
4. 提供 API Key 檢查和費用估算工具
5. 保留舊版介面作為後備選項，漸進式遷移
