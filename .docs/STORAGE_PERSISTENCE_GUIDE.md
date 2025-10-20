# 📦 存儲持久化機制指南

## 概述

本應用使用**三層存儲架構**來管理不同類型的數據：

```
瀏覽器端                          服務器端
┌─────────────────────┐          ┌──────────────────┐
│   localStorage      │          │  SQLite 資料庫   │
│  (客戶端持久化)      │  ←───────│  (服務器持久化)  │
└─────────────────────┘          └──────────────────┘
       ↑                                 ↑
       │ 用戶偏好                       │ 提示詞
       │ (排序、分類)                   │ AI設定
       │                               │ 用戶偏好
```

---

## 1. 提示詞存儲 - **資料庫 (SQLite)**

### 位置
- **服務器端** SQLite 數據庫：`{user_home}/.config/user-feedback-mcp/feedback.db`

### 存儲內容
| 字段 | 說明 | 例子 |
|------|------|------|
| `id` | 提示詞唯一 ID | `1`, `2`, ... |
| `title` | 提示詞標題 | "代碼檢視", "文檔摘要" |
| `content` | 提示詞內容 | "請檢視以下代碼..." |
| `is_pinned` | 是否釘選 | `true` / `false` |
| `category` | 分類 | "代碼", "文檔", "通用" |
| `order_index` | 排序順序 | `1`, `2`, ... |
| `created_at` | 創建時間 | `2025-10-19 10:30:00` |

### 相關 API 端點
```javascript
// 獲取所有提示詞
GET /api/prompts
// 返回: { success: true, prompts: [...] }

// 建立新提示詞
POST /api/prompts
// 請求: { title, content, category, isPinned }

// 更新提示詞
PUT /api/prompts/:id
// 請求: { title, content, category, isPinned }

// 刪除提示詞
DELETE /api/prompts/:id

// 切換釘選狀態
PUT /api/prompts/:id/pin

// 獲取釘選的提示詞
GET /api/prompts/pinned
```

### 特點
✅ **持久保存** - 重啟應用後仍保存  
✅ **多設備同步** - 所有用戶訪問相同數據庫  
✅ **可靠性** - SQLite 事務保證數據完整性  
❌ **本地緩存** - 必須連接到服務器

---

## 2. 用戶偏好 - **雙層存儲**

### 2.1 資料庫存儲 (主存儲)

**服務器端 SQLite 資料庫**

| 類型 | 字段 | 說明 |
|------|------|------|
| 排序偏好 | `sort_preference` | 'recent' / 'name' / 'category' |
| 最後分類 | `last_used_category` | 上次選擇的提示詞分類 |
| UI 偏好 | `ui_preferences` | JSON 格式的 UI 配置 |

### 2.2 瀏覽器 localStorage 存儲 (本地快取)

**客戶端持久化**，用於改善用戶體驗

```javascript
// localStorage 鍵名
const STORAGE_KEYS = {
  PROMPT_FAVORITES: "feedback-app:promptFavorites",      // 最近使用的 10 個提示詞
  LAST_USED_CATEGORY: "feedback-app:lastUsedCategory",   // 最後使用的分類
  SORT_PREFERENCE: "feedback-app:sortPreference",         // 排序方式
  UI_PREFERENCES: "feedback-app:uiPreferences",           // UI 配置
};
```

### 2.3 存儲流程

```
用戶操作
    │
    ↓
瀏覽器 localStorage (即時)
    │
    ↓ (同步)
服務器 SQLite (數秒內)
    │
    ↓
下次啟動時恢復
```

### 2.4 API 端點 (服務器持久化)

```javascript
// 獲取用戶偏好
GET /api/preferences

// 更新用戶偏好
PUT /api/preferences
// 請求: { sort_preference, last_used_category, ui_preferences }
```

---

## 3. 最近使用的提示詞 - **純 localStorage**

### 特點
- **完全本地化** - 不與服務器同步
- **自動更新** - 每次使用提示詞時自動記錄
- **最多 10 個** - 只保留最近使用的 10 個
- **帶時間戳** - 按使用時間排序

### 存儲格式
```javascript
localStorage.getItem("feedback-app:promptFavorites")
// 返回:
[
  { id: 5, title: "代碼檢視", timestamp: 1729355400000 },
  { id: 3, title: "文檔摘要", timestamp: 1729354000000 },
  ...
]
```

### 相關函數 (JavaScript)
```javascript
// 保存為收藏
saveFavoritePrompt(promptId, promptTitle)

// 獲取收藏清單
getFavoritePrompts()  // 返回: [...]

// 移除收藏
removeFavoritePrompt(promptId)

// 渲染最近使用
renderRecentPrompts()  // 顯示於 UI
```

---

## 4. AI 設定存儲 - **資料庫 (SQLite)**

### 位置
- **服務器端** SQLite 數據庫中的 `ai_settings` 表

### 存儲內容
| 字段 | 說明 | 例子 |
|------|------|------|
| `api_url` | AI API 地址 | `https://api.openai.com/v1` |
| `model` | 模型名稱 | `gpt-4o-mini` |
| `api_key` | API 密鑰 | `sk-...` (加密存儲) |
| `system_prompt` | 系統提示詞 | "你是一個代碼審查助手..." |
| `temperature` | 溫度值 | `0.7` |
| `max_tokens` | 最大令牌數 | `2000` |

### 相關 API 端點
```javascript
// 獲取 AI 設定
GET /api/ai-settings

// 更新 AI 設定
PUT /api/ai-settings
// 請求: { apiUrl, model, apiKey, systemPrompt, temperature, maxTokens }

// 驗證 API 密鑰
POST /api/ai-settings/validate
// 請求: { apiKey, model }
```

---

## 5. 存儲對比表

| 存儲類型 | 位置 | 何時保存 | 何時加載 | 可靠性 | 同步 |
|---------|------|---------|---------|--------|------|
| **提示詞** | 服務器 DB | 新增/編輯時 | 應用啟動時 | ⭐⭐⭐⭐⭐ | 即時 |
| **用戶偏好** | 雙層 | 變更時 | 應用啟動時 | ⭐⭐⭐⭐⭐ | 數秒 |
| **最近使用** | localStorage | 使用提示詞時 | 應用啟動時 | ⭐⭐⭐ | 即時 |
| **AI 設定** | 服務器 DB | 手動保存時 | 應用啟動時 | ⭐⭐⭐⭐⭐ | 即時 |
| **工作會話** | 記憶體 | 實時 | N/A | ⭐⭐ | 實時 |

---

## 6. 清除數據

### 清除瀏覽器 localStorage
```javascript
// 清除所有應用數據
localStorage.removeItem("feedback-app:promptFavorites");
localStorage.removeItem("feedback-app:lastUsedCategory");
localStorage.removeItem("feedback-app:sortPreference");
localStorage.removeItem("feedback-app:uiPreferences");
```

### 清除服務器數據庫
```bash
# 重置整個應用
rm ~/.config/user-feedback-mcp/feedback.db

# 或手動刪除表
sqlite3 ~/.config/user-feedback-mcp/feedback.db
sqlite> DELETE FROM prompts;
sqlite> DELETE FROM ai_settings;
```

---

## 7. 常見問題 (FAQ)

### Q: 提示詞是保存在資料庫中還是瀏覽器中?
**A**: 提示詞主要保存在**服務器端 SQLite 資料庫**中，這確保了：
- ✅ 多設備訪問同一數據
- ✅ 應用重啟後保存
- ✅ 所有用戶看到相同的提示詞庫

### Q: 最近使用的提示詞會不會同步?
**A**: **不會同步**。最近使用清單只保存在瀏覽器 localStorage 中，用於改善本地體驗。

### Q: 如果我清除瀏覽器快取會怎樣?
**A**: 
- ❌ 丟失：最近使用清單、排序偏好
- ✅ 保留：所有提示詞、AI 設定（在服務器中）
- 👉 下次進入時會重新加載服務器數據

### Q: 能否在不同電腦上共享提示詞?
**A**: **能**。只要它們連接到同一個服務器，就能訪問相同的提示詞庫。

### Q: 我的 API 密鑰是否安全?
**A**: 是的，API 密鑰：
- 🔒 存儲在服務器端（不會傳給瀏覽器）
- 🔐 不會在任何日誌中記錄
- 🔓 只用於與 AI 服務通信

---

## 8. 架構圖

```
前端界面 (瀏覽器)
    │
    ├─ 編輯提示詞 ──→ [localStorage] ──→ [API] ──→ [SQLite DB]
    │
    ├─ 選擇排序方式 ──→ [localStorage] ──→ [API] ──→ [SQLite DB]
    │
    ├─ 使用提示詞 ──→ [localStorage 記錄] (僅本地)
    │
    └─ 配置 AI ──→ [API] ──→ [SQLite DB (加密)]
```

---

**最後更新**: 2025年10月19日  
**版本**: 2.1.3+
