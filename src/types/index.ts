/**
 * user-feedback MCP Tools - 類型定義
 */

// 基礎設定類型
export interface Config {
  apiKey?: string | undefined;
  apiBaseUrl: string;
  defaultModel: string;
  webPort: number;
  dialogTimeout: number;
  enableChat: boolean;
  corsOrigin: string;
  maxFileSize: number;
  logLevel: string;
  // 新增：伺服器主機設定
  serverHost?: string | undefined;
  serverBaseUrl?: string | undefined;
  // 新增：URL和連接埠最佳化設定
  forcePort?: boolean | undefined;           // 強制使用指定連接埠
  killProcessOnPortConflict?: boolean | undefined;  // 自動終止佔用處理程序
  useFixedUrl?: boolean | undefined;         // 使用固定URL，不帶會話參數
  cleanupPortOnStart?: boolean | undefined;  // 啟動時清理連接埠
  // 新增：圖片轉文字功能設定
  enableImageToText?: boolean | undefined;   // 啟用圖片轉文字功能
  imageToTextPrompt?: string | undefined;    // 圖片轉文字提示詞
}

// 回饋資料類型
export interface FeedbackData {
  text?: string;
  images?: ImageData[];
  imageDescriptions?: string[]; // 圖片描述文字
  timestamp: number;
  sessionId: string;
  shouldCloseAfterSubmit?: boolean; // 提交后是否关闭页面
}

// 圖片資料類型
export interface ImageData {
  name: string;
  data: string; // Base64編碼
  size: number;
  type: string;
}

// 工作匯報類型
export interface WorkSummary {
  content: string;
  timestamp: number;
  sessionId: string;
}

// MCP工具函式參數類型
export interface CollectFeedbackParams {
  work_summary: string;
  project_name?: string | undefined;  // 專案名稱
  project_path?: string | undefined;  // 專案路徑
}

// MCP內容類型 - 符合MCP協定標準
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64编码的图片数据
  mimeType: string; // 图片MIME类型
}

export interface AudioContent {
  type: 'audio';
  data: string; // base64编码的音频数据
  mimeType: string; // 音频MIME类型
}

// MCP內容聯合類型
export type MCPContent = TextContent | ImageContent | AudioContent;

// MCP工具函式回傳類型 - 符合MCP協定要求
export interface CollectFeedbackResult {
  [x: string]: unknown;
  content: MCPContent[];
  isError?: boolean;
}

// WebSocket事件類型
export interface SocketEvents {
  // 連線管理
  connect: () => void;
  disconnect: () => void;

  // 回饋收集
  start_feedback_session: (data: { sessionId: string; workSummary: string }) => void;
  get_work_summary: (data: { feedback_session_id: string }) => void;
  submit_feedback: (data: FeedbackData) => void;
  feedback_submitted: (data: { success: boolean; message?: string }) => void;
  feedback_error: (data: { error: string }) => void;
  work_summary_data: (data: { work_summary: string }) => void;
}

// 伺服器狀態類型
export interface ServerStatus {
  running: boolean;
  port: number;
  startTime: number;
  activeSessions: number;
}

// 會話管理類型
export interface Session {
  id: string;
  workSummary?: string;
  feedback?: FeedbackData[];
  startTime: number;
  timeout: number;
  status: 'active' | 'completed' | 'timeout' | 'error';
  projectId?: string;     // 關聯的專案 ID
  projectName?: string;   // 專案名稱（快取）
}

// 錯誤類型
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// 連接埠管理類型
export interface PortInfo {
  port: number;
  available: boolean;
  pid?: number | undefined;
}

// 日誌級別類型
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silent';

// API設定類型
export interface APIConfig {
  apiKey?: string;
  apiBaseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// 圖片轉文字請求類型
export interface ConvertImagesRequest {
  images: {
    name: string;
    type: string;
    data: string;
  }[];
}

// 圖片轉文字回應類型
export interface ConvertImagesResponse {
  success: boolean;
  descriptions?: string[];
  error?: string;
}

// MCP日誌級別類型
export type MCPLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

// MCP日誌訊息類型
export interface MCPLogMessage {
  level: MCPLogLevel;
  logger?: string;
  data: unknown;
}

// ============ Enhanced Feedback Interface Types ============

// 提示詞類型
export interface Prompt {
  id: number;
  title: string;
  content: string;
  isPinned: boolean;
  orderIndex: number;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

// 創建提示詞請求類型
export interface CreatePromptRequest {
  title: string;
  content: string;
  isPinned?: boolean;
  category?: string;
}

// 更新提示詞請求類型
export interface UpdatePromptRequest {
  title?: string;
  content?: string;
  isPinned?: boolean;
  orderIndex?: number;
  category?: string;
}

// AI 設定類型
export interface AISettings {
  id: number;
  apiUrl: string;
  model: string;
  apiKey: string; // 加密儲存
  systemPrompt: string;
  mcpToolsPrompt?: string; // MCP 工具使用提示詞
  temperature?: number;
  maxTokens?: number;
  autoReplyTimerSeconds?: number;
  maxToolRounds?: number; // AI 交談次數上限
  debugMode?: boolean; // Debug 模式
  createdAt: string;
  updatedAt: string;
}

// AI 設定請求類型（不包含 id 和時間戳）
export interface AISettingsRequest {
  apiUrl?: string;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  mcpToolsPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  autoReplyTimerSeconds?: number;
  maxToolRounds?: number; // AI 交談次數上限
  debugMode?: boolean; // Debug 模式
}

// AI 設定響應類型（API Key 遮罩）
export interface AISettingsResponse {
  id: number;
  apiUrl: string;
  model: string;
  apiKeyMasked: string; // 僅顯示最後4位
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  maxToolRounds?: number; // AI 交談次數上限
  debugMode?: boolean; // Debug 模式
  createdAt: string;
  updatedAt: string;
}

// AI 回覆請求類型
export interface AIReplyRequest {
  aiMessage: string;
  userContext?: string;
  includeMCPTools?: boolean;
  toolResults?: string;
  projectName?: string;
  projectPath?: string;
}

// AI 回覆響應類型
export interface AIReplyResponse {
  success: boolean;
  reply?: string;
  error?: string;
  mode?: 'api' | 'cli';       // 回覆模式
  cliTool?: string;           // 使用的 CLI 工具（僅 CLI 模式）
  promptSent?: string;        // 傳送給 CLI 的完整 prompt
}

// 使用者偏好設定類型
export interface UserPreferences {
  id: number;
  autoReplyTimeout: number; // 秒
  enableAutoReply: boolean;
  theme?: 'light' | 'dark' | 'auto';
  createdAt: string;
  updatedAt: string;
}

// WebSocket 自動回覆事件類型
export interface AutoReplyWarningEvent {
  remainingSeconds: number;
}

export interface AutoReplyTriggeredEvent {
  reply: string;
}

export interface UserActivityEvent {
  sessionId: string;
  timestamp: number;
}

// 調整提示詞順序請求
export interface ReorderPromptsRequest {
  prompts: Array<{
    id: number;
    orderIndex: number;
  }>;
}

// ============ Log Types ============

// 日誌條目類型
export interface LogEntry {
  id?: number;
  level: LogLevel;
  message: string;
  context?: string | undefined; // JSON 格式的額外上下文
  source?: string | undefined;  // 來源模組
  createdAt?: string | undefined;
}

// 日誌查詢選項
export interface LogQueryOptions {
  page?: number;
  limit?: number;
  level?: LogLevel | undefined;
  search?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
}

// 日誌查詢結果
export interface LogQueryResult {
  logs: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 日誌刪除選項
export interface LogDeleteOptions {
  beforeDate?: string;
  level?: LogLevel | undefined;
}

// ============ MCP Server Configuration Types ============

// MCP Server 傳輸類型
export type MCPTransportType = 'stdio' | 'sse' | 'streamable-http';

// MCP Server 配置
export interface MCPServerConfig {
  id: number;
  name: string;
  transport: MCPTransportType;
  // stdio 傳輸設定
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // SSE/HTTP 傳輸設定
  url?: string;
  // 通用設定
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// MCP Server 連接狀態
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// MCP Server 運行時狀態
export interface MCPServerState {
  id: number;
  status: MCPConnectionStatus;
  error?: string | undefined;
  tools: MCPToolInfo[];
  resources: MCPResourceInfo[];
  prompts: MCPPromptInfo[];
  connectedAt?: string | undefined;
}

// MCP Tool 資訊
export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId?: number;
  enabled?: boolean;
}

// MCP Tool 啟用設定
export interface MCPToolEnableConfig {
  id: number;
  serverId: number;
  toolName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// 更新 MCP Tool 啟用狀態請求
export interface UpdateToolEnableRequest {
  serverId: number;
  toolName: string;
  enabled: boolean;
}

// 批次更新 MCP Tool 啟用狀態請求
export interface BatchUpdateToolEnableRequest {
  serverId: number;
  tools: Array<{ toolName: string; enabled: boolean }>;
}

// MCP Server 日誌類型
export type MCPServerLogType = 'connect' | 'disconnect' | 'error' | 'tool_call' | 'info';

// MCP Server 日誌
export interface MCPServerLog {
  id?: number;
  serverId: number;
  serverName: string;
  type: MCPServerLogType;
  message: string;
  details?: string;
  createdAt?: string;
}

// Serena MCP 預設配置
export interface SerenaMCPPreset {
  name: string;
  transport: MCPTransportType;
  command: string;
  args: string[];
  env?: Record<string, string>;
  projectPath?: string;
}

// MCP Resource 資訊
export interface MCPResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType?: string | undefined;
}

// MCP Prompt 資訊
export interface MCPPromptInfo {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }> | undefined;
}

// 創建 MCP Server 請求
export interface CreateMCPServerRequest {
  name: string;
  transport: MCPTransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
}

// 更新 MCP Server 請求
export interface UpdateMCPServerRequest {
  name?: string;
  transport?: MCPTransportType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  enabled?: boolean;
}

// MCP Tool 呼叫請求
export interface MCPToolCallRequest {
  serverId: number;
  toolName: string;
  arguments?: Record<string, unknown>;
}

// MCP Tool 呼叫結果
export interface MCPToolCallResult {
  success: boolean;
  content?: MCPContent[] | undefined;
  error?: string | undefined;
}

// MCP 伺服器列表響應
export interface MCPServersResponse {
  success: boolean;
  servers?: MCPServerConfig[];
  error?: string;
}

// MCP 伺服器狀態響應
export interface MCPServerStateResponse {
  success: boolean;
  state?: MCPServerState;
  error?: string;
}

// 所有 MCP 伺服器的工具彙總
export interface AllMCPToolsResponse {
  success: boolean;
  tools?: Array<MCPToolInfo & { serverId: number; serverName: string }>;
  error?: string;
}


// ============================================
// Multi-AI Dashboard 類型定義
// ============================================

// 專案資訊
export interface Project {
  id: string;                     // 專案唯一識別碼 (基於名稱或路徑的 hash)
  name: string;                   // 顯示名稱
  path?: string | undefined;      // 專案路徑（可選）
  createdAt: string;              // 首次呼叫時間 (ISO string)
  lastActiveAt: string;           // 最後活動時間 (ISO string)
}

// 專案 Session 關聯
export interface ProjectSession {
  projectId: string;
  sessionId: string;
  workSummary: string;
  status: 'waiting' | 'active' | 'completed' | 'timeout';
  createdAt: string;
  lastActivityAt: string;
}

// Dashboard 概覽響應
export interface DashboardOverview {
  projects: DashboardProjectInfo[];
  totalProjects: number;
  totalActiveSessions: number;
}

// Dashboard 專案資訊
export interface DashboardProjectInfo {
  project: Project;
  sessions: DashboardSessionInfo[];
  totalSessions: number;
  activeSessions: number;
}

// Dashboard Session 資訊
export interface DashboardSessionInfo {
  sessionId: string;
  status: string;
  workSummary: string;
  createdAt: string;
  lastActivityAt: string;
}

// Dashboard WebSocket 事件
export interface DashboardSessionCreatedEvent {
  projectId: string;
  sessionId: string;
  projectName: string;
  workSummary: string;
}

export interface DashboardSessionUpdatedEvent {
  projectId: string;
  sessionId: string;
  status: string;
  workSummary?: string;
}

export interface DashboardProjectActivityEvent {
  projectId: string;
  lastActivityAt: string;
}

// ==================== CLI Mode Types ====================

// AI 回應模式
export type AIMode = 'api' | 'cli';

// CLI 工具類型
export type CLIToolType = 'gemini' | 'claude';

// CLI 工具資訊
export interface CLIToolInfo {
  name: CLIToolType;
  installed: boolean;
  version: string | null | undefined;
  path: string | null | undefined;
  command: string;
}

// CLI 檢測結果
export interface CLIDetectionResult {
  tools: CLIToolInfo[];
  timestamp: string;
}

// CLI 執行選項
export interface CLIExecuteOptions {
  tool: CLIToolType;
  prompt: string;
  timeout?: number | undefined;
  workingDirectory?: string | undefined;
  outputFormat?: 'text' | 'json' | undefined;
}

// CLI 執行結果
export interface CLIExecuteResult {
  success: boolean;
  output: string;
  error?: string | undefined;
  exitCode: number;
  executionTime: number;
}

// CLI 錯誤碼
export enum CLIErrorCode {
  NOT_INSTALLED = 'CLI_NOT_INSTALLED',
  TIMEOUT = 'CLI_TIMEOUT',
  EXECUTION_FAILED = 'CLI_EXECUTION_FAILED',
  PARSE_ERROR = 'CLI_PARSE_ERROR',
  PERMISSION_DENIED = 'CLI_PERMISSION_DENIED'
}

// CLI 設定
export interface CLISettings {
  id: number;
  aiMode: AIMode;
  cliTool: CLIToolType;
  cliTimeout: number;
  cliFallbackToApi: boolean;
  createdAt: string;
  updatedAt: string;
}

// CLI 設定請求
export interface CLISettingsRequest {
  aiMode?: AIMode;
  cliTool?: CLIToolType;
  cliTimeout?: number;
  cliFallbackToApi?: boolean;
}

// CLI 設定回應
export interface CLISettingsResponse {
  success: boolean;
  settings?: CLISettings;
  error?: string;
}

// CLI 終端機狀態
export type CLITerminalStatus = 'running' | 'idle' | 'error' | 'stopped';

// CLI 終端機
export interface CLITerminal {
  id: string;
  projectName: string;
  projectPath: string;
  tool: CLIToolType;
  startedAt: string;
  lastActivityAt: string;
  status: CLITerminalStatus;
  pid?: number | undefined;
}

// CLI 執行日誌
export interface CLIExecutionLog {
  id: number;
  terminalId: string;
  prompt: string;
  response: string | null;
  executionTime: number;
  success: boolean;
  error?: string | undefined;
  createdAt: string;
}

// CLI 終端機列表回應
export interface CLITerminalsResponse {
  success: boolean;
  terminals?: CLITerminal[];
  error?: string;
}

// CLI 檢測回應
export interface CLIDetectionResponse {
  success: boolean;
  tools?: CLIToolInfo[];
  timestamp?: string;
  error?: string;
}
