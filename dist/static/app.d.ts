declare function initSocketIO(): void;
declare function updateConnectionStatus(connected: any): void;
declare function initEventListeners(): void;
declare function loadInitialData(): Promise<void>;
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
declare const DIALOG_TIMEOUT_MS: 60000;
//# sourceMappingURL=app.d.ts.map