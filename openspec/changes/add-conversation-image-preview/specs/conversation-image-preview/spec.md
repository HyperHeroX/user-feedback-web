# Conversation Image Preview Specification

## ADDED Requirements

### Requirement: CONV-IMG-001 - Entry Images Display

The system SHALL display images attached to conversation entries as thumbnails within the entry body. Images MUST be rendered in a grid layout with a configurable maximum number of visible thumbnails.

#### Scenario: 顯示單張圖片縮略圖

**Given** 使用者提交包含一張圖片的回饋
**When** 系統創建對話條目
**Then** 對話條目的內容區域顯示一個圖片縮略圖
**And** 縮略圖尺寸為 60x60 像素
**And** 圖片以 `object-fit: cover` 方式填充

#### Scenario: 顯示多張圖片縮略圖

**Given** 使用者提交包含 3 張圖片的回饋
**When** 系統創建對話條目
**Then** 對話條目顯示 3 個圖片縮略圖
**And** 縮略圖以 flex wrap 方式排列
**And** 縮略圖之間有適當的間距

#### Scenario: 超過最大顯示數量的圖片

**Given** 使用者提交包含 6 張圖片的回饋
**And** 最大顯示數量設定為 4
**When** 系統創建對話條目
**Then** 對話條目顯示 4 個圖片縮略圖
**And** 顯示 "+2" 的更多圖片指示器

#### Scenario: 無圖片的對話條目

**Given** 使用者提交純文字回饋
**When** 系統創建對話條目
**Then** 對話條目僅顯示文字內容
**And** 不顯示圖片容器區域

---

### Requirement: CONV-IMG-002 - Image Lightbox Preview

The system SHALL provide a fullscreen lightbox component for viewing images at full resolution. The lightbox MUST support navigation between multiple images.

#### Scenario: 開啟 Lightbox

**Given** 對話條目顯示圖片縮略圖
**When** 使用者點擊任意縮略圖
**Then** 系統開啟 Lightbox 覆蓋層
**And** 顯示被點擊圖片的完整尺寸
**And** 背景變暗且模糊

#### Scenario: 關閉 Lightbox - 點擊關閉按鈕

**Given** Lightbox 已開啟
**When** 使用者點擊右上角的關閉按鈕 (✕)
**Then** Lightbox 關閉
**And** 返回對話面板視圖

#### Scenario: 關閉 Lightbox - 按 ESC 鍵

**Given** Lightbox 已開啟
**When** 使用者按下 ESC 鍵
**Then** Lightbox 關閉
**And** 返回對話面板視圖

#### Scenario: 關閉 Lightbox - 點擊背景

**Given** Lightbox 已開啟
**When** 使用者點擊圖片以外的背景區域
**Then** Lightbox 關閉
**And** 返回對話面板視圖

---

### Requirement: CONV-IMG-003 - Lightbox Navigation

The system SHALL support navigation between multiple images within the lightbox. Navigation MUST be available through both UI controls and keyboard shortcuts.

#### Scenario: 下一張圖片 - 點擊按鈕

**Given** Lightbox 顯示多張圖片中的第一張
**When** 使用者點擊右側導航按鈕 (▶)
**Then** 顯示下一張圖片
**And** 更新頁數指示器 "2 / N"

#### Scenario: 上一張圖片 - 點擊按鈕

**Given** Lightbox 顯示多張圖片中的第二張
**When** 使用者點擊左側導航按鈕 (◀)
**Then** 顯示上一張圖片
**And** 更新頁數指示器 "1 / N"

#### Scenario: 下一張圖片 - 按右方向鍵

**Given** Lightbox 顯示多張圖片中的第一張
**When** 使用者按下右方向鍵 (→)
**Then** 顯示下一張圖片

#### Scenario: 上一張圖片 - 按左方向鍵

**Given** Lightbox 顯示多張圖片中的第二張
**When** 使用者按下左方向鍵 (←)
**Then** 顯示上一張圖片

#### Scenario: 第一張圖片的導航限制

**Given** Lightbox 顯示多張圖片中的第一張
**When** 使用者嘗試按左方向鍵或點擊左導航按鈕
**Then** 圖片保持不變
**And** 左導航按鈕顯示為禁用狀態

#### Scenario: 最後一張圖片的導航限制

**Given** Lightbox 顯示多張圖片中的最後一張
**When** 使用者嘗試按右方向鍵或點擊右導航按鈕
**Then** 圖片保持不變
**And** 右導航按鈕顯示為禁用狀態

#### Scenario: 單張圖片無導航

**Given** 對話條目只有一張圖片
**When** 使用者開啟 Lightbox
**Then** 不顯示導航按鈕
**And** 不顯示頁數指示器

---

### Requirement: CONV-IMG-004 - Integration with Conversation Flow

The system SHALL integrate image display with the existing conversation entry types. Images MUST be displayed in the appropriate entry types.

#### Scenario: 提示詞條目顯示用戶附加的圖片

**Given** 使用者輸入文字並附加了 2 張圖片
**When** 使用者點擊 "AI 回覆" 按鈕
**Then** 對話面板顯示 "📤 提示詞" 條目
**And** 條目內容包含輸入的文字
**And** 條目內容下方顯示 2 張圖片縮略圖

#### Scenario: 提示詞條目無圖片

**Given** 使用者只輸入文字，未附加圖片
**When** 使用者點擊 "AI 回覆" 按鈕
**Then** 對話面板顯示 "📤 提示詞" 條目
**And** 條目僅包含文字內容

---

## MODIFIED Requirements

### Requirement: 修改 createConversationEntry 函數簽名

The `createConversationEntry` function SHALL accept an optional `images` parameter in the options object.

#### Scenario: 函數接受 images 參數

**Given** 開發者調用 `createConversationEntry` 函數
**When** 傳入 `options.images` 陣列
**Then** 函數正確處理圖片數據
**And** 渲染圖片縮略圖到條目中

#### Scenario: 函數向後兼容

**Given** 開發者調用 `createConversationEntry` 函數
**When** 不傳入 `options.images` 參數
**Then** 函數行為與修改前相同
**And** 不渲染圖片區域
