declare function initSocketIO(): void;
declare function updateConnectionStatus(connected: any): void;
declare function initEventListeners(): void;
declare function loadInitialData(): Promise<void>;
declare function loadVersion(): Promise<void>;
declare function loadServerConfig(): Promise<void>;
declare function loadPrompts(): Promise<void>;
declare function loadAISettings(): Promise<void>;
declare function loadPreferences(): Promise<void>;
declare function autoLoadPinnedPrompts(): Promise<void>;
declare function getPinnedPromptsContent(): Promise<any>;
declare function displayProjectInfo(projectName: any, projectPath: any): void;
declare function displayAIMessage(message: any): void;
declare function handleUserActivity(): void;
declare function updateCharCount(): void;
declare function generateAIReply(): Promise<void>;
/**
 * 解析 AI 回覆中的 tool_calls JSON
 * @param {string} aiResponse - AI 的原始回覆
 * @returns {{hasToolCalls: boolean, toolCalls: Array<{name: string, arguments: Object}>, message: string|null}}
 */
declare function parseToolCalls(aiResponse: string): {
    hasToolCalls: boolean;
    toolCalls: Array<{
        name: string;
        arguments: Object;
    }>;
    message: string | null;
};
/**
 * 執行 MCP 工具並返回結果
 * @param {Array<{name: string, arguments: Object}>} toolCalls
 * @returns {Promise<Array<{name: string, success: boolean, result?: any, error?: string}>>}
 */
declare function executeMCPTools(toolCalls: Array<{
    name: string;
    arguments: Object;
}>): Promise<Array<{
    name: string;
    success: boolean;
    result?: any;
    error?: string;
}>>;
/**
 * 格式化工具執行結果為文字
 * @param {Array<{name: string, success: boolean, result?: any, error?: string}>} results
 * @returns {string}
 */
declare function formatToolResults(results: Array<{
    name: string;
    success: boolean;
    result?: any;
    error?: string;
}>): string;
/**
 * 更新工具執行進度 UI
 * @param {number} round - 當前輪次
 * @param {string} status - 狀態: 'thinking', 'executing', 'done', 'error'
 * @param {string} message - 訊息
 * @param {Array} toolCalls - 當前執行的工具
 */
declare function updateToolProgressUI(round: number, status: string, message: string, toolCalls?: any[]): void;
/**
 * 顯示 AI Streaming Panel
 */
declare function showStreamingPanel(): void;
/**
 * 隱藏 AI Streaming Panel
 */
declare function hideStreamingPanel(): void;
/**
 * 更新 Streaming 狀態
 * @param {string} status - 狀態
 * @param {string} text - 狀態文字
 */
declare function updateStreamingStatus(status: string, text: string): void;
/**
 * 添加進度項目到 Streaming Panel
 * @param {string} status - 狀態
 * @param {string} message - 訊息
 * @param {Array} toolCalls - 工具調用列表
 * @param {number} round - 輪次
 */
declare function addStreamingProgress(status: string, message: string, toolCalls?: any[], round?: number): void;
/**
 * 添加輸出內容到 Streaming Panel
 * @param {string} content - 內容
 * @param {string} type - 類型: 'tool-call', 'tool-result', 'ai-message', 'error'
 */
declare function addStreamingOutput(content: string, type?: string): void;
/**
 * 截斷過長的結果
 */
declare function truncateResult(text: any, maxLength?: number): any;
/**
 * HTML 轉義
 */
declare function escapeHtml(text: any): string;
declare function escapeHtml(str: any): string;
declare function escapeHtml(text: any): string;
/**
 * 顯示第 5 輪確認對話框
 * @returns {Promise<boolean>} - true 繼續，false 取消
 */
declare function showRound5Confirmation(): Promise<boolean>;
/**
 * 帶 MCP 工具呼叫支援的 AI 回覆生成
 */
declare function generateAIReplyWithTools(): Promise<void>;
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
 * 暫停自動回覆計時器
 * @param {boolean} byFocus - 是否由焦點事件引起的暫停
 */
declare function pauseAutoReplyTimer(byFocus?: boolean): void;
/**
 * 恢復自動回覆計時器
 */
declare function resumeAutoReplyTimer(): void;
/**
 * 觸發自動 AI 回應
 * 倒數到 0 秒時調用此函數
 * 流程：呼叫 AI 回覆（含工具調用）→ 取得內容 → 彈出 10 秒確認視窗 → 10 秒後提交
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
declare function formatApiError(data: any): string;
declare function showAlertModal(title: any, message: any): void;
declare function hideAlertModal(): void;
declare function showLoadingOverlay(text?: string): void;
declare function hideLoadingOverlay(): void;
declare function openLogViewerModal(): Promise<void>;
declare function closeLogViewerModal(): void;
declare function loadLogSources(): Promise<void>;
declare function loadLogs(page?: number): Promise<void>;
declare function renderLogEntry(log: any): string;
declare function updateLogPagination(): void;
declare function searchLogs(): void;
declare function clearOldLogs(): Promise<void>;
declare function escapeRegex(str: any): any;
declare function loadMCPServers(): Promise<void>;
declare function renderMCPServerList(): void;
declare function renderToolsList(tools: any): string;
declare function getStatusText(status: any): any;
declare function openMCPServersModal(): void;
declare function closeMCPServersModal(): void;
declare function openMCPServerEditModal(server?: null): void;
declare function closeMCPServerEditModal(): void;
declare function onTransportChange(): void;
declare function saveMCPServer(): Promise<void>;
declare function connectMCPServer(id: any): Promise<void>;
declare function disconnectMCPServer(id: any): Promise<void>;
declare function editMCPServer(id: any): void;
declare function deleteMCPServerConfirm(id: any): Promise<void>;
declare function connectAllMCPServers(): Promise<void>;
declare function disconnectAllMCPServers(): Promise<void>;
/**
 * user-feedback MCP Tools - Enhanced UI
 * 前端 JavaScript 主檔案
 */
declare let socket: null;
declare let sessionId: null;
declare let workSummary: null;
declare let currentProjectName: null;
declare let currentProjectPath: null;
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
declare let autoReplyTimerPaused: boolean;
declare let autoReplyPausedByFocus: boolean;
declare let closeCountdownInterval: null;
declare let DIALOG_TIMEOUT_SECONDS: number;
declare let AUTO_REPLY_TIMER_SECONDS: number;
declare let maxToolRounds: number;
declare let debugMode: boolean;
declare let streamingAbortController: null;
declare let currentLogPage: number;
declare let totalLogPages: number;
declare let logSources: any[];
declare let mcpServers: any[];
declare let editingMcpServerId: null;
//# sourceMappingURL=app.d.ts.map