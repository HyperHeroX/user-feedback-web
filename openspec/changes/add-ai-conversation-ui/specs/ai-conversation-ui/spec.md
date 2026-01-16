# AI Conversation UI Specification

## ADDED Requirements

### Requirement: Conversation Entry Display

The system SHALL display AI reply conversation in a clear entry-based interface. Each step MUST be presented as an independent expandable block.

#### Scenario: 顯示發送的提示詞

**Given** 使用者點擊 AI 回覆按鈕
**When** 系統開始處理 AI 回覆請求
**Then** 對話視窗顯示一個「📤 發送的提示詞」條目
**And** 條目包含模式標籤 (API 或 CLI)
**And** 條目包含時間戳
**And** 條目內容可展開/收合

#### Scenario: 顯示 AI 思考狀態

**Given** 系統已發送請求到 AI 服務
**When** 等待 AI 回覆中
**Then** 對話視窗顯示一個「🤔 AI 思考中」條目
**And** 條目顯示載入動畫

#### Scenario: 顯示工具呼叫

**Given** AI 回覆包含 MCP 工具呼叫
**When** 系統解析到工具呼叫請求
**Then** 對話視窗顯示一個「🔧 工具呼叫」條目
**And** 條目內容包含工具名稱和參數

#### Scenario: 顯示工具執行結果

**Given** MCP 工具已執行完成
**When** 系統收到工具執行結果
**Then** 對話視窗顯示一個「📋 工具結果」條目
**And** 條目內容包含執行結果或錯誤訊息

#### Scenario: 顯示 AI 最終回覆

**Given** AI 已生成最終回覆
**When** 系統收到完整的 AI 回覆
**Then** 對話視窗顯示一個「✅ AI 回覆」條目
**And** 回覆內容自動填入回饋文字框
**And** 取消按鈕變為確定按鈕

#### Scenario: 顯示錯誤訊息

**Given** AI 服務處理過程發生錯誤
**When** 系統捕獲到錯誤
**Then** 對話視窗顯示一個「❌ 錯誤」條目
**And** 條目內容包含錯誤詳情

---

### Requirement: AI Provider Factory Pattern

The system SHALL use the Factory Pattern to automatically select API or CLI mode based on user settings. The factory MUST return the appropriate provider implementation.

#### Scenario: 根據設定選擇 API 模式

**Given** 使用者在設定中選擇 API 模式
**When** 觸發 AI 回覆（手動或自動）
**Then** 系統使用 `APIProvider` 處理請求
**And** 對話視窗顯示「API」模式標籤

#### Scenario: 根據設定選擇 CLI 模式

**Given** 使用者在設定中選擇 CLI 模式
**And** CLI 工具已安裝且可用
**When** 觸發 AI 回覆（手動或自動）
**Then** 系統使用 `CLIProvider` 處理請求
**And** 對話視窗顯示「CLI (工具名稱)」模式標籤

#### Scenario: CLI 工具不可用時回退到 API

**Given** 使用者在設定中選擇 CLI 模式
**And** CLI 工具未安裝或不可用
**And** 設定允許回退到 API
**When** 觸發 AI 回覆
**Then** 系統自動使用 `APIProvider` 處理請求
**And** 對話視窗顯示回退提示

---

### Requirement: Unified Auto and Manual AI Reply

The system SHALL use the same conversation panel interface for both manual and automatic AI replies. Both modes MUST display identical conversation flow UI.

#### Scenario: 手動觸發 AI 回覆

**Given** 有活躍的 AI 工作匯報會話
**When** 使用者點擊「AI 回覆」按鈕
**Then** 對話視窗以新 UI 顯示
**And** 顯示完整的對話流程

#### Scenario: 自動觸發 AI 回覆

**Given** 有活躍的 AI 工作匯報會話
**And** 自動回覆計時器到期
**When** 系統自動觸發 AI 回覆
**Then** 對話視窗以新 UI 顯示
**And** 顯示與手動回覆相同的對話流程
