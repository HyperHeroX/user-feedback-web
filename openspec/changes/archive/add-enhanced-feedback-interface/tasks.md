# Implementation Tasks: Enhanced Feedback Interface with AI Integration

## Phase 1: Foundation and Data Layer

### 1. Database Setup
- [x] 1.1 安裝 SQLite 依賴 (`better-sqlite3`)
- [x] 1.2 創建資料庫初始化模組 (`src/utils/database.ts`)
- [x] 1.3 定義資料表結構（prompts, ai_settings, user_preferences）
- [x] 1.4 實作資料庫遷移機制
- [ ] 1.5 編寫資料庫初始化測試

### 2. Encryption and Security
- [x] 2.1 實作 API Key 加密/解密工具 (`src/utils/crypto-helper.ts`)
- [x] 2.2 使用 Node.js crypto 模組實作 AES-256-GCM 加密
- [x] 2.3 生成和儲存加密金鑰（環境變數或安全檔案）
- [ ] 2.4 編寫加密模組單元測試
- [x] 2.5 實作 API Key 驗證機制

### 3. TypeScript Types
- [x] 3.1 定義 `Prompt` 介面（id, title, content, isPinned, order, category）
- [x] 3.2 定義 `AISettings` 介面（id, apiUrl, model, apiKey, systemPrompt）
- [x] 3.3 定義 `AIReplyRequest` 和 `AIReplyResponse` 介面
- [x] 3.4 定義 `UserPreferences` 介面
- [x] 3.5 更新 `src/types/index.ts` 匯出所有新類型

## Phase 2: Backend API Implementation

### 4. Prompt Management API
- [x] 4.1 實作 `GET /api/prompts` - 取得所有提示詞
- [x] 4.2 實作 `POST /api/prompts` - 創建新提示詞
- [x] 4.3 實作 `PUT /api/prompts/:id` - 更新提示詞
- [x] 4.4 實作 `DELETE /api/prompts/:id` - 刪除提示詞
- [x] 4.5 實作 `PUT /api/prompts/:id/pin` - 切換釘選狀態
- [x] 4.6 實作 `PUT /api/prompts/reorder` - 調整順序
- [x] 4.7 新增 API 輸入驗證和錯誤處理

### 5. AI Settings API
- [x] 5.1 實作 `GET /api/ai-settings` - 取得 AI 設定（不返回完整 API Key）
- [x] 5.2 實作 `PUT /api/ai-settings` - 更新 AI 設定
- [x] 5.3 實作 `POST /api/ai-settings/validate` - 驗證 API Key 有效性
- [x] 5.4 API Key 儲存時自動加密
- [x] 5.5 API Key 讀取時自動解密（僅供內部使用）

### 6. AI Integration Service
- [x] 6.1 安裝 Gemini API 客戶端 (`@google/generative-ai`)
- [x] 6.2 創建 AI 服務模組 (`src/utils/ai-service.ts`)
- [x] 6.3 實作 Gemini API 呼叫邏輯
- [x] 6.4 實作重試機制和錯誤處理
- [x] 6.5 實作回應快取（可選）
- [x] 6.6 實作 `POST /api/ai-reply` 端點
- [x] 6.7 支援將 AI 訊息內容作為上下文傳入

### 7. Auto-Reply Timer
- [x] 7.1 實作後端計時器管理模組
- [x] 7.2 在 WebSocket 連線建立時啟動計時器（300 秒）
- [x] 7.3 使用者活動時重置計時器
- [x] 7.4 超時時自動觸發 AI 回覆
- [x] 7.5 實作 WebSocket 事件：`auto_reply_warning`, `auto_reply_triggered`
- [x] 7.6 新增設定選項：`MCP_AUTO_REPLY_TIMEOUT`

## Phase 3: Frontend UI Reconstruction

### 8. Three-Column Layout
- [x] 8.1 安裝 Markdown 渲染器 (`marked`)
- [x] 8.2 重構 `index.html` 為三欄式結構：
  - [x] 8.2.1 左側：AI 訊息顯示區（30%）
  - [x] 8.2.2 中間：使用者互動區（40%）
  - [x] 8.2.3 右側：提示詞管理區（30%）
- [x] 8.3 實作響應式設計（< 768px 切換為單欄）
- [x] 8.4 更新 `style.css` 新增三欄佈局樣式
- [ ] 8.5 確保可存取性（鍵盤導航、ARIA 標籤）

### 9. AI Message Display (Left Panel)
- [x] 9.1 實作 Markdown 渲染器整合
- [ ] 9.2 實作程式碼高亮（可選，使用 Prism.js 或 Highlight.js）
- [x] 9.3 實作訊息捲動和歷史查看
- [ ] 9.4 實作複製按鈕（複製訊息內容）
- [ ] 9.5 實作訊息時間戳顯示

### 10. User Input Area (Middle Panel - Top)
- [x] 10.1 實作多行文字輸入框
- [x] 10.2 實作 Ctrl+Enter 快捷鍵提交
- [x] 10.3 實作空白回應提交（跳過）
- [x] 10.4 實作 AI 回覆按鈕
- [x] 10.5 實作載入狀態和錯誤提示
- [x] 10.6 實作字數統計（可選）

### 11. Image Upload Area (Middle Panel - Bottom)
- [x] 11.1 保留現有圖片上傳功能
- [x] 11.2 調整佈局以符合 40% 高度限制
- [x] 11.3 實作圖片預覽優化（縮圖）
- [x] 11.4 維持拖放和貼上功能

### 12. Prompt Management Panel (Right Panel)
- [x] 12.1 實作提示詞列表顯示
- [x] 12.2 實作搜尋/過濾功能
- [x] 12.3 實作點擊複製到輸入區
- [x] 12.4 實作釘選/取消釘選按鈕
- [x] 12.5 實作新增提示詞表單
- [x] 12.6 實作編輯提示詞（內聯編輯或彈窗）
- [x] 12.7 實作刪除提示詞（附確認對話框）
- [ ] 12.8 實作拖放調整順序（可選）
- [x] 12.9 實作 AI 設定按鈕和彈窗

### 13. AI Settings Modal
- [x] 13.1 創建 AI 設定彈窗 UI
- [x] 13.2 實作表單欄位：
  - [x] 13.2.1 API URL 路徑
  - [x] 13.2.2 模型名稱
  - [x] 13.2.3 API Key（密碼輸入，顯示遮罩）
  - [x] 13.2.4 系統提示詞（多行輸入）
- [x] 13.3 實作表單驗證
- [x] 13.4 實作儲存和取消按鈕
- [x] 13.5 實作 API Key 測試功能
- [x] 13.6 實作錯誤提示和成功通知

### 14. Auto-Reply UI Integration
- [x] 14.1 實作倒數計時器顯示（最後 60 秒）
- [x] 14.2 實作警告提示（視覺和音效）
- [x] 14.3 實作超時自動提交 UI 回饋
- [x] 14.4 實作取消自動回覆按鈕
- [ ] 14.5 實作超時設定調整選項（在設定頁面）

### 15. Data Persistence Integration
- [x] 15.1 實作啟動時載入釘選提示詞
- [x] 15.2 實作提示詞按順序自動複製到輸入區
- [ ] 15.3 實作 LocalStorage 同步（快取）
- [ ] 15.4 實作離線模式支援（可選）
- [x] 15.5 實作資料同步錯誤處理

## Phase 4: Testing and Documentation

### 16. Unit Tests
- [ ] 16.1 測試資料庫 CRUD 操作
- [ ] 16.2 測試加密/解密功能
- [ ] 16.3 測試 AI 服務 API 呼叫（使用 mock）
- [ ] 16.4 測試提示詞管理邏輯
- [ ] 16.5 測試自動回覆計時器

### 17. Integration Tests
- [ ] 17.1 測試完整的提示詞 CRUD 流程
- [ ] 17.2 測試 AI 回覆生成端到端流程
- [ ] 17.3 測試自動回覆觸發機制
- [ ] 17.4 測試多會話並行處理
- [ ] 17.5 測試加密儲存和讀取

### 18. UI/UX Testing
- [ ] 18.1 測試響應式佈局（多種螢幕尺寸）
- [ ] 18.2 測試鍵盤快捷鍵
- [ ] 18.3 測試拖放功能
- [ ] 18.4 測試無障礙功能
- [ ] 18.5 跨瀏覽器測試（Chrome, Firefox, Edge, Safari）

### 19. Documentation
- [ ] 19.1 更新 README.md 新增功能說明
- [ ] 19.2 更新 USER_GUIDE.md 新增使用教學
- [ ] 19.3 更新 CONFIGURATION.md 新增設定選項
- [ ] 19.4 創建 API 文件（提示詞和 AI 設定 API）
- [ ] 19.5 創建資料庫結構文件
- [ ] 19.6 創建遷移指南（從舊版介面）

### 20. Migration and Compatibility
- [ ] 20.1 實作舊版介面保留（`?legacy=true` 參數）
- [ ] 20.2 實作資料遷移腳本（如有現有資料）
- [ ] 20.3 更新版本號和 CHANGELOG
- [ ] 20.4 創建發布公告
- [ ] 20.5 準備範例設定檔案

## Phase 5: Optimization and Polish

### 21. Performance Optimization
- [ ] 21.1 優化 Markdown 渲染效能（懶載入）
- [ ] 21.2 優化圖片處理效能
- [ ] 21.3 實作 AI API 回應快取
- [ ] 21.4 優化資料庫查詢（索引）
- [ ] 21.5 減少前端打包大小

### 22. Security Audit
- [ ] 22.1 審查 API Key 儲存安全性
- [ ] 22.2 審查 SQL 注入防護
- [ ] 22.3 審查 XSS 防護
- [ ] 22.4 審查 CORS 設定
- [ ] 22.5 實作速率限制（API 端點）

### 23. Final Polish
- [ ] 23.1 修復 lint 錯誤
- [ ] 23.2 優化錯誤訊息和使用者提示
- [ ] 23.3 新增載入動畫和過渡效果
- [ ] 23.4 新增使用教學提示（首次使用）
- [ ] 23.5 最終端到端測試

## Validation Checkpoints

- [x] Phase 1 完成：資料庫可正常初始化，加密功能通過測試
- [x] Phase 2 完成：所有 API 端點正常運作，通過 Postman/curl 測試
- [x] Phase 3 完成：UI 三欄佈局完整實作，響應式設計正常
- [ ] Phase 4 完成：所有測試通過，文件更新完成
- [ ] Phase 5 完成：效能和安全審查通過，準備發布

## Dependencies and Blockers

### Critical Dependencies
- SQLite 資料庫設定必須在 Phase 2 之前完成
- Markdown 渲染器選擇必須在 Phase 3.8 之前確定
- Gemini API 存取權限必須在 Phase 2.6 之前取得

### Potential Blockers
- Gemini API 費用和配額限制
- SQLite 在不同平台的相容性問題
- 響應式設計在某些裝置上的挑戰
- API Key 加密金鑰的安全儲存方案

## Notes

- 建議使用特性分支進行開發：`feature/enhanced-feedback-interface`
- 每個 Phase 完成後進行 code review
- 關鍵功能完成後立即進行使用者測試
- 保持與產品負責人的定期溝通，確認 UI/UX 設計符合預期
