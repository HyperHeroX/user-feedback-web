# Enhanced Feedback Interface 使用指南

## 📖 概述

Enhanced Feedback Interface 是 user-feedback MCP Tools 的新一代使用者界面，提供更強大的功能和更好的使用體驗。

## ✨ 主要特性

### 1. 三欄式佈局
- **左側（30%）**：AI 工作匯報顯示區
  - Markdown 渲染支援
  - 程式碼語法高亮
  - 可捲動查看歷史訊息

- **中間（40%）**：使用者互動區
  - 文字回應輸入（支援 Ctrl+Enter 快速提交）
  - 圖片上傳/貼上功能
  - AI 輔助回覆按鈕

- **右側（30%）**：提示詞管理區
  - 提示詞 CRUD 操作
  - 搜尋和過濾功能
  - 釘選常用提示詞
  - AI 設定管理

### 2. AI 輔助回覆
- 整合 Google Gemini API
- 根據 AI 工作匯報自動生成建議回覆
- 可自訂系統提示詞
- 重試機制和錯誤處理

### 3. 提示詞管理系統
- 創建、編輯、刪除提示詞
- 釘選功能（啟動時自動載入）
- 分類和搜尋
- 點擊快速插入

### 4. 自動回覆機制
- 5 分鐘無活動自動觸發 AI 回覆
- 倒數 60 秒警告提示
- 可取消自動回覆
- 可調整超時時間

### 5. 資料持久化
- SQLite 資料庫儲存
- API Key 加密保護（AES-256-GCM）
- 自動儲存使用者偏好

## 🚀 使用方法

### 啟動增強版介面

有兩種方式啟動：

#### 方式 1：直接訪問
```
http://localhost:3000/index-enhanced.html
```

#### 方式 2：修改預設頁面
將 `src/server/web-server.ts` 中的預設路由改為：
```typescript
this.app.get('/', (req, res) => {
  res.sendFile('index-enhanced.html', { root: staticPath });
});
```

### 首次設定

1. **配置 AI 設定**
   - 點擊右上角的 ⚙️ 按鈕
   - 輸入 Gemini API Key
   - 設定 API URL（預設：`https://generativelanguage.googleapis.com/v1beta`）
   - 設定模型名稱（預設：`gemini-2.0-flash-exp`）
   - 自訂系統提示詞（可選）
   - 點擊「測試連接」驗證 API Key
   - 儲存設定

2. **創建提示詞**
   - 在右側面板點擊「新增提示詞」
   - 輸入標題和內容
   - 選擇是否釘選（釘選後會在啟動時自動載入）
   - 儲存

### 日常使用

1. **等待 AI 工作匯報**
   - 系統會自動顯示 AI 的工作匯報在左側面板
   - 支援 Markdown 格式

2. **撰寫回應**
   - 在中間輸入區輸入您的回應
   - 或點擊右側提示詞快速插入
   - 或點擊「AI 回覆」按鈕生成建議回應
   - 可上傳圖片作為補充

3. **提交反饋**
   - 按 Ctrl+Enter 或點擊「提交回應」按鈕
   - 系統會清空輸入區，準備下一次反饋

### 快捷鍵

- `Ctrl+Enter`：提交回應
- `Ctrl+V`：貼上圖片

## 🔧 環境變數配置

### 加密金鑰
```bash
# 設定 API Key 加密的主金鑰（建議使用）
export MCP_ENCRYPTION_PASSWORD="your-secure-password-here"
```

如果不設定，系統會使用預設金鑰（不建議用於生產環境）。

### 自動回覆超時
```bash
# 預設為 300 秒（5 分鐘），可以通過資料庫的 user_preferences 表調整
```

## 📊 資料庫結構

### 資料表

#### prompts
儲存使用者的提示詞
- `id`: 主鍵
- `title`: 標題
- `content`: 內容
- `is_pinned`: 是否釘選（0/1）
- `order_index`: 排序索引
- `category`: 分類（選填）
- `created_at`: 創建時間
- `updated_at`: 更新時間

#### ai_settings
儲存 AI 設定
- `id`: 主鍵
- `api_url`: API URL
- `model`: 模型名稱
- `api_key`: API Key（加密儲存）
- `system_prompt`: 系統提示詞
- `temperature`: 溫度參數
- `max_tokens`: 最大 token 數
- `created_at`: 創建時間
- `updated_at`: 更新時間

#### user_preferences
儲存使用者偏好設定
- `id`: 主鍵
- `auto_reply_timeout`: 自動回覆超時（秒）
- `enable_auto_reply`: 是否啟用自動回覆（0/1）
- `theme`: 主題（light/dark/auto）
- `created_at`: 創建時間
- `updated_at`: 更新時間

### 資料庫位置
```
data/feedback.db
```

### 備份建議
定期備份資料庫文件：
```bash
cp data/feedback.db data/backups/feedback-$(date +%Y%m%d).db
```

## 🔒 安全性

### API Key 保護
- 使用 AES-256-GCM 加密
- 每個加密操作使用唯一的 IV（初始化向量）
- 加密金鑰通過 scrypt 從主密碼派生
- API Key 在前端顯示時僅顯示遮罩版本（例如：`sk-****1234`）

### 資料安全
- 本地 SQLite 資料庫
- 沒有網路傳輸使用者資料
- API 呼叫僅發送至配置的 Gemini API

## 🐛 疑難排解

### 問題：API Key 驗證失敗
**解決方法**：
1. 檢查 API Key 是否正確
2. 確認模型名稱是否有效
3. 檢查網路連接
4. 查看瀏覽器控制台的錯誤訊息

### 問題：資料庫初始化失敗
**解決方法**：
1. 檢查 `data` 目錄的寫入權限
2. 確認沒有其他程序正在使用資料庫文件
3. 刪除損壞的資料庫文件並重新啟動

### 問題：自動回覆未觸發
**解決方法**：
1. 檢查使用者偏好設定中是否啟用自動回覆
2. 確認 AI 設定已正確配置
3. 查看服務器日誌的錯誤訊息

### 問題：提示詞無法釘選
**解決方法**：
1. 檢查資料庫連接
2. 嘗試刷新頁面
3. 查看瀏覽器控制台的錯誤訊息

## 📝 API 端點

### 提示詞管理
- `GET /api/prompts` - 獲取所有提示詞
- `GET /api/prompts/pinned` - 獲取釘選的提示詞
- `POST /api/prompts` - 創建新提示詞
- `PUT /api/prompts/:id` - 更新提示詞
- `DELETE /api/prompts/:id` - 刪除提示詞
- `PUT /api/prompts/:id/pin` - 切換釘選狀態
- `PUT /api/prompts/reorder` - 調整順序

### AI 設定
- `GET /api/ai-settings` - 獲取 AI 設定
- `PUT /api/ai-settings` - 更新 AI 設定
- `POST /api/ai-settings/validate` - 驗證 API Key

### AI 回覆
- `POST /api/ai-reply` - 生成 AI 回覆

### 使用者偏好
- `GET /api/preferences` - 獲取使用者偏好
- `PUT /api/preferences` - 更新使用者偏好

## 🎨 自訂樣式

CSS 文件位於 `src/static/style-enhanced.css`，使用 CSS 變數定義主題：

```css
:root {
    --bg-primary: #1e1e1e;
    --bg-secondary: #252526;
    --accent-blue: #007acc;
    /* ... 更多變數 */
}
```

可以修改這些變數來自訂主題顏色。

## 📞 支援

如遇問題，請：
1. 查看此文件的疑難排解章節
2. 檢查 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. 提交 Issue 到 GitHub 儲存庫

## 🔄 版本兼容性

- 最低 Node.js 版本：18.0.0
- 支援的瀏覽器：
  - Chrome/Edge 90+
  - Firefox 88+
  - Safari 14+

## 📜 授權

MIT License - 詳見 [LICENSE](./LICENSE) 文件

