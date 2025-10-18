declare function initSocketIO(): void;
declare function updateConnectionStatus(connected: any): void;
declare function initEventListeners(): void;
declare function loadInitialData(): Promise<void>;
declare function loadServerConfig(): Promise<void>;
declare function loadPrompts(): Promise<void>;
declare function loadAISettings(): Promise<void>;
declare function loadPreferences(): Promise<void>;
declare function autoLoadPinnedPrompts(): Promise<void>;
declare function getPinnedPromptsContent(): Promise<any>;
declare function displayAIMessage(message: any): void;
declare function handleUserActivity(): void;
declare function updateCharCount(): void;
declare function generateAIReply(): Promise<void>;
declare function submitFeedback(): Promise<void>;
declare function clearInputs(): void;
/**
 * 選擇性清除提交輸入 - 清空文本、圖片、字數計數，但保留提示詞狀態
 * 用於成功提交反饋後
 */
declare function clearSubmissionInputs(): void;
/**
 * 停止所有計時器
 */
declare function stopAllTimers(): void;
/**
 * 開始關閉頁面倒數計時
 * 從 MCP_DIALOG_TIMEOUT 取得秒數，倒數到 0 時自動關閉頁面
 */
declare function startCloseCountdown(): void;
declare function handleFileSelect(e: any): void;
declare function handleFileDrop(files: any): void;
declare function handlePaste(e: any): void;
declare function readImageFile(file: any): void;
declare function addImagePreview(dataUrl: any, index: any): void;
declare function removeImage(index: any): void;
declare function clearImages(): void;
declare function updateImageCount(): void;
declare function renderPrompts(searchTerm?: string): void;
declare function filterPrompts(): void;
declare function usePrompt(id: any): void;
declare function togglePinPrompt(id: any): Promise<void>;
declare function editPrompt(id: any): void;
declare function deletePrompt(id: any): Promise<void>;
declare function openPromptModal(): void;
declare function closePromptModal(): void;
declare function savePrompt(): Promise<void>;
declare function openAISettingsModal(): void;
declare function closeAISettingsModal(): void;
declare function saveAISettings(): Promise<void>;
declare function testAPIKey(): Promise<void>;
declare function toggleAPIKeyVisibility(): void;
declare function showAutoReplyWarning(seconds: any): void;
declare function hideAutoReplyWarning(): void;
/**
 * [已廢棄] 原本用於 AI 回覆對話超時計時
 * 現在由 startCloseCountdown() 統一處理頁面關閉倒數
 */
declare function startDialogTimeout(): void;
/**
 * 開始自動回應倒數計時（300 秒）
 * 顯示在 auto-reply-timer 容器中（中間下方）
 * 當倒數到 0 秒時自動啟動 AI 回應
 */
declare function startAutoReplyTimer(): void;
/**
 * 觸發自動 AI 回應
 * 倒數到 0 秒時調用此函數
 * 流程：呼叫 AI 回覆 → 取得內容 → 彈出 10 秒確認視窗 → 10 秒後提交
 */
declare function triggerAutoAIReply(): Promise<void>;
/**
 * 開始自動回覆倒數計時
 * 用於自動回覆觸發時，不自動提交反饋
 * 倒數完成時由 showAutoReplyConfirmModal 控制提交邏輯
 */
declare function startAutoReplyCountdown(): void;
/**
 * 停止自動回覆倒數計時
 */
declare function stopAutoReplyCountdown(): void;
declare function cancelAutoReply(): void;
/**
 * 顯示自動回覆確認模態框
 */
/**
 * 顯示自動回覆確認模態框
 * 彈出 10 秒確認視窗，超過 10 秒後自動提交
 */
declare function showAutoReplyConfirmModal(replyContent: any): void;
/**
 * 隱藏自動回覆確認模態框
 */
declare function hideAutoReplyConfirmModal(): void;
/**
 * 確認自動回覆提交
 */
declare function confirmAutoReplySubmit(): void;
/**
 * 取消自動回覆
 */
declare function cancelAutoReplyConfirm(): void;
declare function showToast(type: any, title: any, message: any): void;
declare function getToastIcon(type: any): "✅" | "❌" | "ℹ️" | "📢";
declare function showAlertModal(title: any, message: any): void;
declare function hideAlertModal(): void;
declare function showLoadingOverlay(text?: string): void;
declare function hideLoadingOverlay(): void;
declare function escapeHtml(text: any): string;
/**
 * user-feedback MCP Tools - Enhanced UI
 * 前端 JavaScript 主檔案
 */
declare let socket: null;
declare let sessionId: null;
declare let workSummary: null;
declare let currentImages: any[];
declare let prompts: any[];
declare let aiSettings: null;
declare let preferences: null;
declare let autoReplyWarningTimeout: null;
declare let autoReplyCountdownInterval: null;
declare let autoReplyCountdownRemaining: number;
declare let autoReplyConfirmationTimeout: null;
declare let autoReplyData: null;
declare let isEditingPrompt: boolean;
declare let editingPromptId: null;
declare let dialogTimeoutInterval: null;
declare let autoReplyTimerInterval: null;
declare let autoReplyTimerRemaining: number;
declare let closeCountdownInterval: null;
declare let DIALOG_TIMEOUT_SECONDS: number;
declare let AUTO_REPLY_TIMER_SECONDS: number;
//# sourceMappingURL=app.d.ts.map