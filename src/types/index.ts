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
  temperature?: number;
  maxTokens?: number;
  autoReplyTimerSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

// AI 設定請求類型（不包含 id 和時間戳）
export interface AISettingsRequest {
  apiUrl?: string;
  model?: string;
  apiKey?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  autoReplyTimerSeconds?: number;
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
  createdAt: string;
  updatedAt: string;
}

// AI 回覆請求類型
export interface AIReplyRequest {
  aiMessage: string;
  userContext?: string;
}

// AI 回覆響應類型
export interface AIReplyResponse {
  success: boolean;
  reply?: string;
  error?: string;
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
