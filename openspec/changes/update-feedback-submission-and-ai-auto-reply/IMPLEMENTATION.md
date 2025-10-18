# 實施驗證指南

## Phase 1: 反饋提交重置 ✅ 完成

### 已實施的更改

1. **新函數 `clearSubmissionInputs()`** (src/static/app-enhanced.js)
   - 清除：textarea、images、char count、image preview、image count badge
   - 保留：prompt state、AI settings、Socket.IO connection
   - 位置：第 529-575 行

2. **更新 `feedback_submitted` 事件處理器** (src/static/app-enhanced.js)
   - 使用 `clearSubmissionInputs()` 替代 `clearInputs()`
   - 添加 3 秒自動關閉邏輯
   - 位置：第 80-93 行

3. **更新 `feedback_error` 事件處理器** (src/static/app-enhanced.js)
   - 確保錯誤時保留輸入
   - 頁面保持開啟
   - 位置：第 95-104 行

### 測試場景

```
✓ 場景 1.1: 成功提交
  1. 輸入文字和上傳圖片
  2. 點擊提交按鈕
  3. 驗證：文字、圖片、char count 被清除
  4. 驗證：提示詞配置仍在
  5. 驗證：3 秒後頁面自動關閉

✓ 場景 1.2: 提交錯誤
  1. 輸入文字和上傳圖片
  2. 模擬錯誤響應
  3. 驗證：顯示錯誤 toast
  4. 驗證：所有輸入保持不變
  5. 驗證：頁面保持開啟
  6. 驗證：用戶可修改並重新提交
```

---

## Phase 2: 自動回覆確認彈窗 ✅ 完成

### 已實施的更改

1. **新 HTML 結構** (src/static/index-enhanced.html)
   - ID: `autoReplyConfirmModal`
   - 包含：回覆預覽、倒計時計數器、進度條、確認/取消按鈕
   - 位置：第 259-293 行

2. **全局狀態變數** (src/static/app-enhanced.js)
   - `autoReplyData`: 儲存待確認的回覆
   - `autoReplyCountdownTimeout`: 計時器引用
   - 位置：第 17-20 行

3. **倒計時函數** (src/static/app-enhanced.js)
   - `startAutoReplyCountdown()`: 啟動 10 秒倒計時
   - `hideAutoReplyConfirmModal()`: 隱藏並清理
   - `showAutoReplyConfirmModal()`: 顯示預覽並啟動倒計時
   - `confirmAutoReplySubmit()`: 用戶確認提交
   - `cancelAutoReplyConfirm()`: 用戶取消
   - 位置：第 1037-1104 行

4. **更新事件處理器** (src/static/app-enhanced.js)
   - `auto_reply_triggered`: 改為顯示確認彈窗而非直接填充
   - 位置：第 116-137 行

5. **事件監聽器** (src/static/app-enhanced.js)
   - 確認按鈕、取消按鈕、Escape 鍵
   - 位置：第 273-289 行

### 測試場景

```
✓ 場景 2.1: 自動回覆倒計時
  1. 觸發自動回覆
  2. 驗證：確認彈窗出現
  3. 驗證：回覆內容預覽正確
  4. 驗證：倒計時從 10 開始
  5. 驗證：倒計時每秒遞減
  6. 驗證：進度條相應縮小
  
✓ 場景 2.2: 用戶確認
  1. 倒計時中點擊「確認送出」
  2. 驗證：彈窗關閉
  3. 驗證：回覆填入 textarea
  4. 驗證：自動提交反饋
  5. 驗證：應用 Phase 1 的重置邏輯
  6. 驗證：3 秒後頁面自動關閉

✓ 場景 2.3: 倒計時自動完成
  1. 觸發自動回覆，不操作
  2. 驗證：等待 10 秒
  3. 驗證：自動執行確認提交
  4. 驗證：應用 Phase 1 的重置和關閉邏輯

✓ 場景 2.4: 用戶取消
  1. 倒計時中點擊「取消」
  2. 驗證：彈窗關閉
  3. 驗證：計時器停止
  4. 驗證：頁面保持開啟
  5. 驗證：沒有自動提交

✓ 場景 2.5: Escape 鍵取消
  1. 倒計時中按 Escape
  2. 驗證：行為與場景 2.4 相同
```

---

## Phase 3: AI 設定中的提示詞編輯 ✅ 完成

### 已實施的更改

1. **新按鈕** (src/static/index-enhanced.html)
   - ID: `editPromptsFromSettings`
   - 標籤：「編輯提示詞」
   - 圖標：📝
   - 位置：AI Settings modal footer，在「測試連接」和「儲存設定」之間
   - 位置：第 201-204 行

2. **事件監聽器** (src/static/app-enhanced.js)
   - 點擊時調用 `openPromptModal()`
   - 位置：第 247-253 行

3. **模態層疊驗證** (src/static/style-enhanced.css)
   - 所有模態使用統一的 z-index: 2000
   - 基於 DOM 順序實現正確的層疊
   - 無 z-index 衝突

### 測試場景

```
✓ 場景 3.1: 從 AI 設定打開提示詞編輯
  1. 打開 AI Settings 彈窗
  2. 驗證：「編輯提示詞」按鈕可見
  3. 點擊按鈕
  4. 驗證：Prompt 模態打開
  5. 驗證：兩個模態都不重疊（層疊正確）

✓ 場景 3.2: 編輯提示詞後返回
  1. 從 AI Settings 打開提示詞編輯
  2. 創建或編輯提示詞
  3. 點擊「儲存」
  4. 驗證：Prompt 模態關閉
  5. 驗證：AI Settings 模態仍然開啟
  6. 驗證：數據未遺失

✓ 場景 3.3: 關閉模態
  1. 從 AI Settings 打開提示詞編輯
  2. 點擊「取消」或彈窗覆蓋層
  3. 驗證：Prompt 模態關閉
  4. 驗證：AI Settings 模態仍然開啟
```

---

## 完整集成測試流程

### 測試流程 A: 成功提交 + 自動關閉

```
1. 加載應用
2. 輸入回覆文字
3. 上傳 1-2 張圖片
4. 點擊「提交回應」
5. 驗證：
   ✓ 顯示成功 toast
   ✓ 文字被清除
   ✓ 圖片被清除
   ✓ 提示詞配置保留
   ✓ 3 秒後自動關閉頁面
```

### 測試流程 B: 自動回覆確認 + 提交

```
1. 加載應用，等待 AI 工作匯報
2. 等待自動回覆觸發
3. 驗證：
   ✓ 確認彈窗出現
   ✓ 回覆預覽正確
   ✓ 倒計時開始 (10秒)
4. 在倒計時中點擊「確認送出」
5. 驗證：
   ✓ 彈窗關閉
   ✓ 回覆填入 textarea
   ✓ 自動提交
   ✓ 清除提交輸入 (Phase 1)
   ✓ 3 秒後自動關閉
```

### 測試流程 C: 自動回覆超時

```
1. 加載應用，等待 AI 工作匯報
2. 等待自動回覆觸發
3. 驗證：確認彈窗出現
4. 不操作，等待倒計時完成 (10秒)
5. 驗證：
   ✓ 倒計時精確計時
   ✓ 時間到後自動提交
   ✓ 應用 Phase 1 的重置和關閉邏輯
```

### 測試流程 D: 提示詞管理集成

```
1. 打開 AI Settings 彈窗
2. 點擊「編輯提示詞」
3. 創建新提示詞
   - 標題：測試提示詞
   - 內容：這是測試
   - 點擊「儲存」
4. 驗證：Prompt 模態關閉，AI Settings 保持開啟
5. 點擊「儲存設定」
6. 驗證：AI Settings 彈窗關閉
7. 再次打開 AI Settings
8. 驗證：新提示詞已保存
```

---

## 代碼覆蓋

### 已修改的檔案

1. **src/static/app-enhanced.js**
   - 新增 ~200 行代碼
   - 修改 3 個 Socket.IO 事件處理器
   - 修改事件監聽器初始化

2. **src/static/index-enhanced.html**
   - 新增 1 個模態彈窗 (35 行)
   - 新增 1 個按鈕 (4 行)

3. **src/static/style-enhanced.css**
   - 無修改（現有 z-index 配置已適用）

### 檔案行數變化

```
Before:
  app-enhanced.js: 1054 lines
  index-enhanced.html: 272 lines
  style-enhanced.css: 939 lines

After:
  app-enhanced.js: ~1350 lines (+296)
  index-enhanced.html: ~340 lines (+68)
  style-enhanced.css: 939 lines (無變)
```

---

## 驗收準則

所有以下項目必須 PASS 才能認為實施完整：

### 功能驗收

- [ ] Task 1.1: `clearSubmissionInputs()` 正確清除指定元素
- [ ] Task 1.2: 成功提交後 3 秒自動關閉
- [ ] Task 1.3: 錯誤時保留輸入並保持頁面開啟
- [ ] Task 2.1: 確認彈窗 HTML 結構完整
- [ ] Task 2.2: 全局變數可訪問
- [ ] Task 2.3: 倒計時函數準確計時 (±1 秒)
- [ ] Task 2.4: auto_reply_triggered 顯示彈窗而非直接填充
- [ ] Task 2.5: 確認/取消/Escape 功能正常
- [ ] Task 3.1: 編輯提示詞按鈕可見
- [ ] Task 3.2: 點擊按鈕打開提示詞模態
- [ ] Task 3.3: 模態層疊正確，無視覺問題

### 質量驗收

- [ ] 構建成功（npm run build）
- [ ] 無 TypeScript 類型錯誤
- [ ] 無瀏覽器控制台錯誤
- [ ] 計時器無記憶體洩漏
- [ ] 所有現有功能保持正常
- [ ] 跨瀏覽器相容性 (Chrome, Firefox, Edge, Safari)

---

## 已知限制和注意事項

1. **計時器精度**: 倒計時基於 `setInterval(1000)`，在高負載情況下可能有 ±1 秒誤差
2. **Markdown 渲染**: 回覆預覽使用 Marked.js 渲染，若渲染失敗會回退到純文本
3. **模態覆蓋**: 基於 DOM 順序，確保 autoReplyConfirmModal 在 promptModal 之後
4. **移動設備**: 倒計時 UI 在小屏幕上的可視性可能需要 CSS 調整

---

**生成日期**: 2025-10-19  
**版本**: 2.1.3  
**狀態**: 實施完成，待 Phase 4-5 驗證和清理
