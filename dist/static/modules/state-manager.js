/**
 * state-manager.js
 * 全域狀態管理模組
 * 集中管理 app.js 中的所有全域狀態變數
 */

const AppState = {
  // Socket.IO 連線
  socket: null,
  sessionId: null,

  // 專案資訊
  currentProjectName: null,
  currentProjectPath: null,

  // AI 相關
  workSummary: null,
  aiSettings: null,
  maxToolRounds: 5,
  debugMode: false,

  // 圖片
  currentImages: [],

  // 提示詞
  prompts: [],
  isEditingPrompt: false,
  editingPromptId: null,

  // 使用者偏好
  preferences: {},

  // 計時器狀態
  DIALOG_TIMEOUT_SECONDS: 60,
  AUTO_REPLY_TIMER_SECONDS: 300,
  autoReplyTimerRemaining: 0,
  autoReplyTimerPaused: false,
  autoReplyPausedByFocus: false,
  autoReplyData: null,

  // 計時器 ID
  dialogTimeoutInterval: null,
  closeCountdownInterval: null,
  autoReplyTimerInterval: null,
  autoReplyCountdownInterval: null,
  autoReplyWarningTimeout: null,
  autoReplyConfirmationTimeout: null,

  // Streaming
  streamingAbortController: null,

  // MCP Servers
  mcpServers: [],
  editingMcpServerId: null,

  // 日誌
  currentLogPage: 1,
  totalLogPages: 1,
  logSources: [],
};

// Getter 函數
export function getSocket() {
  return AppState.socket;
}

export function getSessionId() {
  return AppState.sessionId;
}

export function getWorkSummary() {
  return AppState.workSummary;
}

export function getCurrentImages() {
  return AppState.currentImages;
}

export function getPrompts() {
  return AppState.prompts;
}

export function getAISettings() {
  return AppState.aiSettings;
}

export function getPreferences() {
  return AppState.preferences;
}

export function getMaxToolRounds() {
  return AppState.maxToolRounds;
}

export function getDebugMode() {
  return AppState.debugMode;
}

export function getDialogTimeoutSeconds() {
  return AppState.DIALOG_TIMEOUT_SECONDS;
}

export function getAutoReplyTimerSeconds() {
  return AppState.AUTO_REPLY_TIMER_SECONDS;
}

export function getCurrentProjectName() {
  return AppState.currentProjectName;
}

export function getCurrentProjectPath() {
  return AppState.currentProjectPath;
}

export function getStreamingAbortController() {
  return AppState.streamingAbortController;
}

export function getMcpServers() {
  return AppState.mcpServers;
}

export function getEditingMcpServerId() {
  return AppState.editingMcpServerId;
}

export function isEditingPrompt() {
  return AppState.isEditingPrompt;
}

export function getEditingPromptId() {
  return AppState.editingPromptId;
}

export function getAutoReplyTimerRemaining() {
  return AppState.autoReplyTimerRemaining;
}

export function isAutoReplyTimerPaused() {
  return AppState.autoReplyTimerPaused;
}

export function isAutoReplyPausedByFocus() {
  return AppState.autoReplyPausedByFocus;
}

export function getAutoReplyData() {
  return AppState.autoReplyData;
}

// Timer ID getters
export function getDialogTimeoutInterval() {
  return AppState.dialogTimeoutInterval;
}

export function getCloseCountdownInterval() {
  return AppState.closeCountdownInterval;
}

export function getAutoReplyTimerInterval() {
  return AppState.autoReplyTimerInterval;
}

export function getAutoReplyCountdownInterval() {
  return AppState.autoReplyCountdownInterval;
}

export function getAutoReplyWarningTimeout() {
  return AppState.autoReplyWarningTimeout;
}

export function getAutoReplyConfirmationTimeout() {
  return AppState.autoReplyConfirmationTimeout;
}

// Log getters
export function getCurrentLogPage() {
  return AppState.currentLogPage;
}

export function getTotalLogPages() {
  return AppState.totalLogPages;
}

export function getLogSources() {
  return AppState.logSources;
}

// Setter 函數
export function setSocket(socket) {
  AppState.socket = socket;
}

export function setSessionId(id) {
  AppState.sessionId = id;
}

export function setWorkSummary(summary) {
  AppState.workSummary = summary;
}

export function setCurrentImages(images) {
  AppState.currentImages = images;
}

export function addImage(image) {
  AppState.currentImages.push(image);
}

export function removeImageAt(index) {
  AppState.currentImages.splice(index, 1);
}

export function clearImages() {
  AppState.currentImages = [];
}

export function setPrompts(prompts) {
  AppState.prompts = prompts;
}

export function setAISettings(settings) {
  AppState.aiSettings = settings;
}

export function setPreferences(prefs) {
  AppState.preferences = prefs;
}

export function setMaxToolRounds(rounds) {
  AppState.maxToolRounds = rounds;
}

export function setDebugMode(mode) {
  AppState.debugMode = mode;
}

export function setDialogTimeoutSeconds(seconds) {
  AppState.DIALOG_TIMEOUT_SECONDS = seconds;
}

export function setAutoReplyTimerSeconds(seconds) {
  AppState.AUTO_REPLY_TIMER_SECONDS = seconds;
}

export function setCurrentProjectName(name) {
  AppState.currentProjectName = name;
}

export function setCurrentProjectPath(path) {
  AppState.currentProjectPath = path;
}

export function setStreamingAbortController(controller) {
  AppState.streamingAbortController = controller;
}

export function setMcpServers(servers) {
  AppState.mcpServers = servers;
}

export function setEditingMcpServerId(id) {
  AppState.editingMcpServerId = id;
}

export function setIsEditingPrompt(editing) {
  AppState.isEditingPrompt = editing;
}

export function setEditingPromptId(id) {
  AppState.editingPromptId = id;
}

export function setAutoReplyTimerRemaining(remaining) {
  AppState.autoReplyTimerRemaining = remaining;
}

export function setAutoReplyTimerPaused(paused) {
  AppState.autoReplyTimerPaused = paused;
}

export function setAutoReplyPausedByFocus(paused) {
  AppState.autoReplyPausedByFocus = paused;
}

export function setAutoReplyData(data) {
  AppState.autoReplyData = data;
}

// Timer ID setters
export function setDialogTimeoutInterval(id) {
  AppState.dialogTimeoutInterval = id;
}

export function setCloseCountdownInterval(id) {
  AppState.closeCountdownInterval = id;
}

export function setAutoReplyTimerInterval(id) {
  AppState.autoReplyTimerInterval = id;
}

export function setAutoReplyCountdownInterval(id) {
  AppState.autoReplyCountdownInterval = id;
}

export function setAutoReplyWarningTimeout(id) {
  AppState.autoReplyWarningTimeout = id;
}

export function setAutoReplyConfirmationTimeout(id) {
  AppState.autoReplyConfirmationTimeout = id;
}

// Log setters
export function setCurrentLogPage(page) {
  AppState.currentLogPage = page;
}

export function setTotalLogPages(pages) {
  AppState.totalLogPages = pages;
}

export function setLogSources(sources) {
  AppState.logSources = sources;
}

// 工具函數
export function findPromptById(id) {
  return AppState.prompts.find((p) => p.id === id);
}

export function findMcpServerById(id) {
  return AppState.mcpServers.find((s) => s.id === id);
}

// 清除所有計時器 ID
export function clearAllTimerIds() {
  AppState.dialogTimeoutInterval = null;
  AppState.closeCountdownInterval = null;
  AppState.autoReplyTimerInterval = null;
  AppState.autoReplyCountdownInterval = null;
  AppState.autoReplyWarningTimeout = null;
  AppState.autoReplyConfirmationTimeout = null;
}

// 匯出整個狀態（僅供調試）
export function getFullState() {
  return { ...AppState };
}

export default AppState;
