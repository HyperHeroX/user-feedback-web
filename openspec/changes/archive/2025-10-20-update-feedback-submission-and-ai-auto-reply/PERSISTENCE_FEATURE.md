# 持久化用戶提示詞偏好功能文檔

## 功能概述

本功能透過 localStorage 持久化用戶的提示詞相關偏好，提升用戶體驗：

- **提示詞收藏**: 自動保存用戶使用過的提示詞
- **最後使用分類**: 記住用戶上次使用的提示詞分類
- **排序偏好**: 存儲用戶偏好的排序方式
- **UI 偏好**: 保存用戶界面相關設定

---

## 實現細節

### 1. 存儲鍵常量

位置: `src/static/app-enhanced.js` 行 23-30

```javascript
const STORAGE_KEYS = {
  PROMPT_FAVORITES: 'feedback-app:promptFavorites',
  LAST_USED_CATEGORY: 'feedback-app:lastUsedCategory',
  SORT_PREFERENCE: 'feedback-app:sortPreference',
  UI_PREFERENCES: 'feedback-app:uiPreferences',
};
```

### 2. localStorage API 函數

位置: `src/static/app-enhanced.js` 行 434-570

#### 提示詞收藏函數

- `saveFavoritePrompt(promptId, promptTitle)` - 保存到收藏
- `getFavoritePrompts()` - 獲取收藏列表
- `removeFavoritePrompt(promptId)` - 移除收藏

#### 分類偏好函數

- `saveLastUsedCategory(category)` - 保存最後使用分類
- `getLastUsedCategory()` - 讀取最後使用分類

#### 排序偏好函數

- `saveSortPreference(sortBy)` - 保存排序方式
- `getSortPreference()` - 讀取排序方式

#### UI 偏好函數

- `saveUIPreferences(preferences)` - 保存 UI 設定
- `getUIPreferences()` - 讀取 UI 設定

### 3. 提示詞使用流程

**使用提示詞**:
1. 用戶點擊提示詞或在最近使用中選擇
2. 調用 `usePrompt(id)` (行 909-930)
3. 自動調用 `saveFavoritePrompt()` 保存
4. 調用 `renderRecentPrompts()` 更新 UI

**打開提示詞模態框**:
1. 調用 `openPromptModal()` (行 1001-1014)
2. 自動恢復最後使用的分類
3. 提高用戶操作效率

**保存提示詞**:
1. 在 `savePrompt()` (行 1031-1062) 中
2. 自動保存分類到 `lastUsedCategory`
3. 新建提示詞自動加入收藏

### 4. UI 元素

位置: `src/static/index-enhanced.html` 行 109-114

最近使用提示詞區域:
- ID: `recentPrompts`
- 子容器: `recentPromptsList`
- 顯示最多 10 個最近使用的提示詞標籤

### 5. CSS 樣式

位置: `src/static/style-enhanced.css` 行 491-527

- `.recent-prompts` - 容器樣式
- `.recent-prompts-title` - 標題樣式
- `.recent-prompts-list` - 列表容器（網格布局）
- `.recent-prompt-tag` - 提示詞標籤樣式

---

## 使用場景

### 場景 1: 新增提示詞

1. 用戶點擊「新增提示詞」
2. 之前使用的分類自動填充
3. 填寫內容後保存
4. 新提示詞自動加入收藏
5. 最近使用列表立即更新

### 場景 2: 使用收藏的提示詞

1. 用戶看到「⭐ 最近使用」區域
2. 點擊提示詞標籤快速使用
3. 提示詞內容插入反饋文本
4. 收藏時間戳更新，排序改變

### 場景 3: 持久化跨會話

1. 用戶使用某些提示詞
2. 關閉瀏覽器標籤頁
3. 重新打開應用
4. 最近使用的提示詞仍然顯示
5. 最後使用的分類仍然記住

---

## 數據結構

### 提示詞收藏格式

```javascript
[
  {
    id: 1,
    title: "代碼審查",
    timestamp: 1697000000000
  },
  {
    id: 2,
    title: "功能說明",
    timestamp: 1697000100000
  }
]
```

最多保存 10 條，超過時移除最舊的。

### UI 偏好格式

```javascript
{
  sidebarCollapsed: false,
  prompting: {
    sortBy: "recent",  // 'recent' | 'name' | 'category'
    categoryFilter: "功能"
  },
  theme: "light"  // 可擴展
}
```

---

## 存儲限制

- **localStorage 容量**: 通常 5-10MB per domain
- **當前估計使用**: < 10KB
- **擴展空間**: 充足

---

## 向後兼容性

- ✅ 不影響現有功能
- ✅ 漸進式增強
- ✅ 自動降級（無 localStorage 時仍可用）

---

## 錯誤處理

所有 localStorage 操作都有 try-catch:

```javascript
try {
  localStorage.setItem(key, value);
} catch (error) {
  console.error('操作失敗:', error);
  // 應用仍然可用
}
```

---

## 隱私考慮

- localStorage 存儲在本地瀏覽器
- 無伺服器端同步
- 用戶可手動清除瀏覽器數據

---

## 測試建議

### 單元測試

- [ ] `saveFavoritePrompt()` 正確保存
- [ ] `getFavoritePrompts()` 返回正確數據
- [ ] 超過 10 個時移除最舊的
- [ ] `getLastUsedCategory()` 恢復正確

### 集成測試

- [ ] 新增提示詞自動加入收藏
- [ ] 打開模態框恢復分類
- [ ] 最近使用列表正確更新
- [ ] localStorage 清除後重新初始化

### 手動測試

- [ ] 刷新頁面後數據持久化
- [ ] 關閉標籤頁後重新打開數據存在
- [ ] 最近使用標籤能正確使用提示詞
- [ ] 超過 10 個收藏時只顯示最新 10 個

---

## 未來改進

- [ ] 提示詞同步到伺服器
- [ ] 多設備同步
- [ ] 自定義倒計時時間
- [ ] 提示詞導出/導入
- [ ] 提示詞版本歷史

---

**實現狀態**: ✅ 完成並驗證
**構建狀態**: ✅ npm run build 通過
**可用性**: 即時上線
