# Tasks: add-conversation-image-preview

## T001: 新增 image-lightbox.js 模組 ✅

- **File**: `src/static/modules/image-lightbox.js`
- **Action**: 創建 Lightbox 元件模組
- **Details**:
  - 實作 `ImageLightbox` 物件
  - `open(images, startIndex)` - 開啟 Lightbox
  - `close()` - 關閉 Lightbox
  - `next()` / `prev()` - 切換圖片
  - `bindKeyboard()` / `unbindKeyboard()` - 鍵盤事件處理
  - `render()` - 渲染 DOM 結構
- **Verification**: 單獨測試 Lightbox 開關和導航功能
- **Dependencies**: 無
- **Parallelizable**: Yes
- **Status**: ✅ 完成 (2026-01-27)

---

## T002: 新增 Lightbox CSS 樣式 ✅

- **File**: `src/static/style.css`
- **Action**: 添加 Lightbox 相關 CSS 樣式
- **Details**:
  - `.image-lightbox` - 覆蓋層樣式
  - `.lightbox-container` - 主容器
  - `.lightbox-image` - 圖片顯示
  - `.lightbox-close` - 關閉按鈕
  - `.lightbox-nav` - 導航按鈕
  - `.lightbox-counter` - 頁數指示器
- **Verification**: 視覺檢查 Lightbox 外觀
- **Dependencies**: 無
- **Parallelizable**: Yes
- **Status**: ✅ 完成 (2026-01-27)

---

## T003: 新增 Entry Images CSS 樣式 ✅

- **File**: `src/static/style.css`
- **Action**: 添加對話條目圖片容器樣式
- **Details**:
  - `.entry-images` - 圖片容器
  - `.entry-image-thumb` - 縮略圖樣式
  - `.entry-image-more` - 更多圖片指示器
  - 懸停效果和過渡動畫
- **Verification**: 視覺檢查縮略圖排列和懸停效果
- **Dependencies**: 無
- **Parallelizable**: Yes
- **Status**: ✅ 完成 (2026-01-27)

---

## T004: 擴展 createConversationEntry 函數 ✅

- **File**: `src/static/modules/conversation-panel.js`
- **Action**: 修改函數支援圖片渲染
- **Details**:
  - 新增 `renderEntryImages(images, maxThumbnails)` 輔助函數
  - 在 `createConversationEntry` 中調用 `renderEntryImages`
  - 處理 `options.images` 參數
  - 設定縮略圖點擊事件
- **Verification**: 調用 `addConversationEntry` 並傳入圖片，驗證渲染正確
- **Dependencies**: T001, T003
- **Parallelizable**: No
- **Status**: ✅ 完成 (2026-01-27)

---

## T005: 新增 Lightbox DOM 容器到 index.html ✅

- **File**: `src/static/index.html`
- **Action**: 動態創建 Lightbox 容器（無需修改 HTML）
- **Details**:
  - Lightbox DOM 由 `image-lightbox.js` 動態創建
  - 結構包含：overlay, container, image, nav, counter
- **Verification**: 檢查 HTML 結構正確
- **Dependencies**: 無
- **Parallelizable**: Yes
- **Status**: ✅ 完成 (2026-01-27) - 使用動態創建方式

---

## T006: 整合 Lightbox 模組到 app-core.js ✅

- **File**: `src/static/modules/app-core.js`
- **Action**: 導入並初始化 Lightbox 模組
- **Details**:
  - 導入 `image-lightbox.js`
  - 導出 `openImageLightbox` 全域函數
  - 設定鍵盤事件監聽
- **Verification**: 在瀏覽器控制台驗證全域函數可用
- **Dependencies**: T001
- **Parallelizable**: No
- **Status**: ✅ 完成 (2026-01-27)

---

## T007: 修改 feedback-handler.js 傳遞圖片到對話條目 ✅

- **File**: `src/static/modules/feedback-handler.js`
- **Action**: 在 addConversationEntry 調用中傳遞 images
- **Details**:
  - 在提示詞條目中傳遞 `currentImages`
  - 確保圖片數據格式正確 `{ type, data }`
  - 修改了 4 處 addConversationEntry 調用
- **Verification**: 提交帶圖片的回饋，驗證對話條目顯示圖片
- **Dependencies**: T004
- **Parallelizable**: No
- **Status**: ✅ 完成 (2026-01-27)

---

## T008: E2E 測試 - 圖片預覽完整流程 ⏳

- **File**: 測試腳本
- **Action**: 使用 Browser Automation Tools 測試完整流程
- **Details**:
  1. 上傳圖片到圖片區域
  2. 點擊 AI 回覆按鈕
  3. 驗證對話條目顯示圖片縮略圖
  4. 點擊縮略圖開啟 Lightbox
  5. 測試左右導航和關閉功能
- **Verification**: 所有測試步驟通過
- **Dependencies**: T001-T007
- **Parallelizable**: No
- **Status**: ⏳ 待測試

---

## T009: 響應式設計調整 ✅

- **File**: `src/static/style.css`
- **Action**: 添加響應式媒體查詢
- **Details**:
  - 小螢幕調整縮略圖尺寸
  - 調整 Lightbox 導航按鈕位置
  - 觸控設備支援優化
- **Verification**: 在不同螢幕尺寸下測試顯示效果
- **Dependencies**: T002, T003
- **Parallelizable**: No
- **Status**: ✅ 完成 (2026-01-27) - 已包含在 T002/T003 中

---

## 執行順序建議

```
Phase 1 (並行):
├── T001: image-lightbox.js 模組
├── T002: Lightbox CSS 樣式
├── T003: Entry Images CSS 樣式
└── T005: index.html Lightbox 容器

Phase 2 (依序):
├── T006: app-core.js 整合
├── T004: conversation-panel.js 擴展
└── T007: feedback-handler.js 修改

Phase 3 (依序):
├── T009: 響應式設計
└── T008: E2E 測試
```
