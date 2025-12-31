/**
 * user-feedback MCP Tools - 類型定義
 */
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
    serverHost?: string | undefined;
    serverBaseUrl?: string | undefined;
    forcePort?: boolean | undefined;
    killProcessOnPortConflict?: boolean | undefined;
    useFixedUrl?: boolean | undefined;
    cleanupPortOnStart?: boolean | undefined;
    enableImageToText?: boolean | undefined;
    imageToTextPrompt?: string | undefined;
    lockFilePath?: string | undefined;
    healthCheckTimeout?: number | undefined;
    forceNewInstance?: boolean | undefined;
}
export interface FeedbackData {
    text?: string;
    images?: ImageData[];
    imageDescriptions?: string[];
    timestamp: number;
    sessionId: string;
    shouldCloseAfterSubmit?: boolean;
}
export interface ImageData {
    name: string;
    data: string;
    size: number;
    type: string;
}
export interface WorkSummary {
    content: string;
    timestamp: number;
    sessionId: string;
}
export interface CollectFeedbackParams {
    work_summary: string;
    project_name?: string | undefined;
    project_path?: string | undefined;
}
export interface TextContent {
    type: 'text';
    text: string;
}
export interface ImageContent {
    type: 'image';
    data: string;
    mimeType: string;
}
export interface AudioContent {
    type: 'audio';
    data: string;
    mimeType: string;
}
export type MCPContent = TextContent | ImageContent | AudioContent;
export interface CollectFeedbackResult {
    [x: string]: unknown;
    content: MCPContent[];
    isError?: boolean;
}
export interface SocketEvents {
    connect: () => void;
    disconnect: () => void;
    start_feedback_session: (data: {
        sessionId: string;
        workSummary: string;
    }) => void;
    get_work_summary: (data: {
        feedback_session_id: string;
    }) => void;
    submit_feedback: (data: FeedbackData) => void;
    feedback_submitted: (data: {
        success: boolean;
        message?: string;
    }) => void;
    feedback_error: (data: {
        error: string;
    }) => void;
    work_summary_data: (data: {
        work_summary: string;
    }) => void;
}
export interface ServerStatus {
    running: boolean;
    port: number;
    startTime: number;
    activeSessions: number;
}
export interface Session {
    id: string;
    workSummary?: string;
    feedback?: FeedbackData[];
    startTime: number;
    timeout: number;
    status: 'active' | 'completed' | 'timeout' | 'error';
    projectId?: string;
    projectName?: string;
}
export declare class MCPError extends Error {
    code: string;
    details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}
export interface PortInfo {
    port: number;
    available: boolean;
    pid?: number | undefined;
}
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silent';
export interface APIConfig {
    apiKey?: string;
    apiBaseUrl: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}
export interface ConvertImagesRequest {
    images: {
        name: string;
        type: string;
        data: string;
    }[];
}
export interface ConvertImagesResponse {
    success: boolean;
    descriptions?: string[];
    error?: string;
}
export type MCPLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
export interface MCPLogMessage {
    level: MCPLogLevel;
    logger?: string;
    data: unknown;
}
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
export interface CreatePromptRequest {
    title: string;
    content: string;
    isPinned?: boolean;
    category?: string;
}
export interface UpdatePromptRequest {
    title?: string;
    content?: string;
    isPinned?: boolean;
    orderIndex?: number;
    category?: string;
}
export interface AISettings {
    id: number;
    apiUrl: string;
    model: string;
    apiKey: string;
    systemPrompt: string;
    mcpToolsPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    autoReplyTimerSeconds?: number;
    maxToolRounds?: number;
    debugMode?: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface AISettingsRequest {
    apiUrl?: string;
    model?: string;
    apiKey?: string;
    systemPrompt?: string;
    mcpToolsPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    autoReplyTimerSeconds?: number;
    maxToolRounds?: number;
    debugMode?: boolean;
}
export interface AISettingsResponse {
    id: number;
    apiUrl: string;
    model: string;
    apiKeyMasked: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    maxToolRounds?: number;
    debugMode?: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface AIReplyRequest {
    aiMessage: string;
    userContext?: string;
    includeMCPTools?: boolean;
    toolResults?: string;
    projectName?: string;
    projectPath?: string;
}
export interface AIReplyResponse {
    success: boolean;
    reply?: string;
    error?: string;
    mode?: 'api' | 'cli';
    cliTool?: string;
    promptSent?: string;
}
export interface UserPreferences {
    id: number;
    autoReplyTimeout: number;
    enableAutoReply: boolean;
    theme?: 'light' | 'dark' | 'auto';
    createdAt: string;
    updatedAt: string;
}
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
export interface ReorderPromptsRequest {
    prompts: Array<{
        id: number;
        orderIndex: number;
    }>;
}
export interface LogEntry {
    id?: number;
    level: LogLevel;
    message: string;
    context?: string | undefined;
    source?: string | undefined;
    createdAt?: string | undefined;
}
export interface LogQueryOptions {
    page?: number;
    limit?: number;
    level?: LogLevel | undefined;
    search?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
}
export interface LogQueryResult {
    logs: LogEntry[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface LogDeleteOptions {
    beforeDate?: string;
    level?: LogLevel | undefined;
}
export type MCPTransportType = 'stdio' | 'sse' | 'streamable-http';
export interface MCPServerConfig {
    id: number;
    name: string;
    transport: MCPTransportType;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}
export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
export interface MCPServerState {
    id: number;
    status: MCPConnectionStatus;
    error?: string | undefined;
    errorDetails?: string | undefined;
    tools: MCPToolInfo[];
    resources: MCPResourceInfo[];
    prompts: MCPPromptInfo[];
    connectedAt?: string | undefined;
    lastError?: string | undefined;
    lastErrorAt?: string | undefined;
    reconnectAttempts?: number | undefined;
    maxReconnectAttempts?: number | undefined;
    nextReconnectAt?: string | undefined;
}
export interface MCPToolInfo {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    serverId?: number;
    enabled?: boolean;
}
export interface MCPToolEnableConfig {
    id: number;
    serverId: number;
    toolName: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface UpdateToolEnableRequest {
    serverId: number;
    toolName: string;
    enabled: boolean;
}
export interface BatchUpdateToolEnableRequest {
    serverId: number;
    tools: Array<{
        toolName: string;
        enabled: boolean;
    }>;
}
export type MCPServerLogType = 'connect' | 'disconnect' | 'error' | 'tool_call' | 'info';
export interface MCPServerLog {
    id?: number;
    serverId: number;
    serverName: string;
    type: MCPServerLogType;
    message: string;
    details?: string;
    createdAt?: string;
}
export interface SerenaMCPPreset {
    name: string;
    transport: MCPTransportType;
    command: string;
    args: string[];
    env?: Record<string, string>;
    projectPath?: string;
}
export interface MCPResourceInfo {
    uri: string;
    name: string;
    description: string;
    mimeType?: string | undefined;
}
export interface MCPPromptInfo {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required: boolean;
    }> | undefined;
}
export interface CreateMCPServerRequest {
    name: string;
    transport: MCPTransportType;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    enabled?: boolean;
}
export interface UpdateMCPServerRequest {
    name?: string;
    transport?: MCPTransportType;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    enabled?: boolean;
}
export interface MCPToolCallRequest {
    serverId: number;
    toolName: string;
    arguments?: Record<string, unknown>;
}
export interface MCPToolCallResult {
    success: boolean;
    content?: MCPContent[] | undefined;
    error?: string | undefined;
}
export interface MCPServersResponse {
    success: boolean;
    servers?: MCPServerConfig[];
    error?: string;
}
export interface MCPServerStateResponse {
    success: boolean;
    state?: MCPServerState;
    error?: string;
}
export interface AllMCPToolsResponse {
    success: boolean;
    tools?: Array<MCPToolInfo & {
        serverId: number;
        serverName: string;
    }>;
    error?: string;
}
export interface Project {
    id: string;
    name: string;
    path?: string | undefined;
    createdAt: string;
    lastActiveAt: string;
}
export interface ProjectSession {
    projectId: string;
    sessionId: string;
    workSummary: string;
    status: 'waiting' | 'active' | 'completed' | 'timeout';
    createdAt: string;
    lastActivityAt: string;
}
export interface DashboardOverview {
    projects: DashboardProjectInfo[];
    totalProjects: number;
    totalActiveSessions: number;
}
export interface DashboardProjectInfo {
    project: Project;
    sessions: DashboardSessionInfo[];
    totalSessions: number;
    activeSessions: number;
}
export interface DashboardSessionInfo {
    sessionId: string;
    status: string;
    workSummary: string;
    createdAt: string;
    lastActivityAt: string;
}
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
export type AIMode = 'api' | 'cli';
export type CLIToolType = 'gemini' | 'claude';
export interface CLIToolInfo {
    name: CLIToolType;
    installed: boolean;
    version: string | null | undefined;
    path: string | null | undefined;
    command: string;
}
export interface CLIDetectionResult {
    tools: CLIToolInfo[];
    timestamp: string;
}
export interface CLIExecuteOptions {
    tool: CLIToolType;
    prompt: string;
    timeout?: number | undefined;
    workingDirectory?: string | undefined;
    outputFormat?: 'text' | 'json' | undefined;
}
export interface CLIExecuteResult {
    success: boolean;
    output: string;
    error?: string | undefined;
    exitCode: number;
    executionTime: number;
}
export declare enum CLIErrorCode {
    NOT_INSTALLED = "CLI_NOT_INSTALLED",
    TIMEOUT = "CLI_TIMEOUT",
    EXECUTION_FAILED = "CLI_EXECUTION_FAILED",
    PARSE_ERROR = "CLI_PARSE_ERROR",
    PERMISSION_DENIED = "CLI_PERMISSION_DENIED"
}
export interface CLISettings {
    id: number;
    aiMode: AIMode;
    cliTool: CLIToolType;
    cliTimeout: number;
    cliFallbackToApi: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface CLISettingsRequest {
    aiMode?: AIMode;
    cliTool?: CLIToolType;
    cliTimeout?: number;
    cliFallbackToApi?: boolean;
}
export interface CLISettingsResponse {
    success: boolean;
    settings?: CLISettings;
    error?: string;
}
export type CLITerminalStatus = 'running' | 'idle' | 'error' | 'stopped';
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
export interface CLITerminalsResponse {
    success: boolean;
    terminals?: CLITerminal[];
    error?: string;
}
export interface CLIDetectionResponse {
    success: boolean;
    tools?: CLIToolInfo[];
    timestamp?: string;
    error?: string;
}
//# sourceMappingURL=index.d.ts.map