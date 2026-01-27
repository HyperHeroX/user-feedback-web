# Proposal: add-conversation-image-preview

## Status

**In Progress** | Created: 2026-01-27 | Implementation: 2026-01-27

## Why

目前對話面板 (Conversation Panel) 中的條目只支援純文字顯示。當使用者發送包含圖片的回饋，或當 AI 回覆包含圖片時，對話條目無法直觀地顯示這些圖片。使用者需要離開對話視窗才能查看相關圖片。

本提案旨在：
1. 在對話條目中顯示圖片縮略圖
2. 提供點擊放大預覽功能 (Lightbox)
3. 支援多圖片的預覽瀏覽

## What Changes

### 前端 UI 新增

1. **對話條目圖片顯示**
   - 在 `createConversationEntry` 函數中新增圖片渲染邏輯
   - 圖片以縮略圖形式顯示在條目內容區
   - 支援多張圖片的網格排列

2. **圖片 Lightbox 元件**
   - 點擊縮略圖開啟全螢幕預覽
   - 支援左右切換多張圖片
   - 支援鍵盤操作 (ESC 關閉, 方向鍵切換)
   - 支援縮放和拖曳

3. **樣式擴展**
   - 新增 `.entry-images` 圖片容器樣式
   - 新增 `.entry-image-thumb` 縮略圖樣式
   - 新增 `.image-lightbox` Lightbox 樣式

### 數據流調整

1. **對話條目數據結構**
   - `options.images` 新增圖片陣列支援
   - 圖片格式：`{ type: string, data: string }` (Base64)

2. **整合點**
   - 提示詞條目：顯示使用者附加的圖片
   - AI 回覆條目：顯示 AI 生成的圖片 (若有)

## Scope

- **In scope:**
  - 對話條目圖片縮略圖顯示
  - 圖片 Lightbox 預覽元件
  - 多圖片瀏覽支援
  - 鍵盤和觸控操作支援

- **Out of scope:**
  - 圖片編輯功能
  - 圖片下載功能
  - 圖片壓縮或格式轉換

## Dependencies

- 依賴 `conversation-panel.js` 模組
- 依賴現有的 CSS 變數系統

## Risks

1. **效能影響** - 大量或大尺寸圖片可能影響滾動效能
   - 緩解：使用縮略圖，延遲載入 Lightbox
   
2. **記憶體使用** - Base64 圖片佔用較多記憶體
   - 緩解：限制顯示圖片數量

## References

- 現有實作: `src/static/modules/conversation-panel.js`
- 圖片處理: `src/static/modules/image-handler.js`
- 樣式檔案: `src/static/style.css`
- 關聯提案: `add-ai-conversation-ui` (對話 UI 改進)
