/**
 * SQLite 資料庫管理模組
 * 使用 better-sqlite3 進行資料持久化
 */
import Database from 'better-sqlite3';
import type { Prompt, CreatePromptRequest, UpdatePromptRequest, AISettings, AISettingsRequest, UserPreferences, LogEntry, LogQueryOptions, LogQueryResult, LogDeleteOptions, MCPServerConfig, CreateMCPServerRequest, UpdateMCPServerRequest, MCPServerLog, MCPServerLogType } from '../types/index.js';
/**
 * 初始化資料庫
 * 創建資料目錄和資料表
 */
export declare function initDatabase(): Database.Database;
/**
 * 關閉資料庫連接
 */
export declare function closeDatabase(): void;
/**
 * 獲取資料庫實例
 */
export declare function getDatabase(): Database.Database;
/**
 * 獲取所有提示詞
 */
export declare function getAllPrompts(): Prompt[];
/**
 * 根據 ID 獲取提示詞
 */
export declare function getPromptById(id: number): Prompt | undefined;
/**
 * 創建新提示詞
 */
export declare function createPrompt(data: CreatePromptRequest): Prompt;
/**
 * 更新提示詞
 */
export declare function updatePrompt(id: number, data: UpdatePromptRequest): Prompt;
/**
 * 刪除提示詞
 */
export declare function deletePrompt(id: number): boolean;
/**
 * 切換提示詞釘選狀態
 */
export declare function togglePromptPin(id: number): Prompt;
/**
 * 調整提示詞順序
 */
export declare function reorderPrompts(prompts: Array<{
    id: number;
    orderIndex: number;
}>): void;
/**
 * 獲取釘選的提示詞（按順序）
 */
export declare function getPinnedPrompts(): Prompt[];
/**
 * 獲取 AI 設定
 */
export declare function getAISettings(): AISettings | undefined;
/**
 * 更新 AI 設定
 */
export declare function updateAISettings(data: AISettingsRequest): AISettings;
/**
 * 獲取使用者偏好設定
 */
export declare function getUserPreferences(): UserPreferences;
/**
 * 更新使用者偏好設定
 */
export declare function updateUserPreferences(data: Partial<Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>>): UserPreferences;
/**
 * 插入單筆日誌
 */
export declare function insertLog(log: Omit<LogEntry, 'id'>): void;
/**
 * 批次插入日誌
 */
export declare function insertLogs(logs: Omit<LogEntry, 'id'>[]): void;
/**
 * 查詢日誌
 */
export declare function queryLogs(options?: LogQueryOptions): LogQueryResult;
/**
 * 刪除日誌
 */
export declare function deleteLogs(options?: LogDeleteOptions): number;
/**
 * 清理過期日誌
 * @param retentionDays 保留天數，預設 30 天
 */
export declare function cleanupOldLogs(retentionDays?: number): number;
/**
 * 獲取日誌來源列表（用於篩選下拉選單）
 */
export declare function getLogSources(): string[];
/**
 * 獲取所有 MCP Servers
 */
export declare function getAllMCPServers(): MCPServerConfig[];
/**
 * 獲取已啟用的 MCP Servers
 */
export declare function getEnabledMCPServers(): MCPServerConfig[];
/**
 * 獲取已啟用的非延遲啟動 MCP Servers
 */
export declare function getEnabledNonDeferredMCPServers(): MCPServerConfig[];
/**
 * 獲取已啟用的延遲啟動 MCP Servers
 */
export declare function getDeferredMCPServers(): MCPServerConfig[];
/**
 * 根據 ID 獲取 MCP Server
 */
export declare function getMCPServerById(id: number): MCPServerConfig | null;
/**
 * 創建 MCP Server
 */
export declare function createMCPServer(data: CreateMCPServerRequest): MCPServerConfig;
/**
 * 更新 MCP Server
 */
export declare function updateMCPServer(id: number, data: UpdateMCPServerRequest): MCPServerConfig;
/**
 * 刪除 MCP Server
 */
export declare function deleteMCPServer(id: number): boolean;
/**
 * 切換 MCP Server 啟用狀態
 */
export declare function toggleMCPServerEnabled(id: number): MCPServerConfig;
/**
 * 獲取 Server 的工具啟用配置
 */
export declare function getToolEnableConfigs(serverId: number): Map<string, boolean>;
/**
 * 設定單一工具的啟用狀態
 */
export declare function setToolEnabled(serverId: number, toolName: string, enabled: boolean): void;
/**
 * 批次設定工具啟用狀態
 */
export declare function batchSetToolEnabled(serverId: number, tools: Array<{
    toolName: string;
    enabled: boolean;
}>): void;
/**
 * 檢查工具是否啟用（預設啟用）
 */
export declare function isToolEnabled(serverId: number, toolName: string): boolean;
/**
 * 刪除 Server 的所有工具配置（在刪除 Server 時使用）
 */
export declare function deleteToolEnableConfigs(serverId: number): void;
/**
 * 插入 MCP Server 日誌
 */
export declare function insertMCPServerLog(log: Omit<MCPServerLog, 'id' | 'createdAt'>): void;
/**
 * 查詢 MCP Server 日誌
 */
export declare function queryMCPServerLogs(options: {
    serverId?: number;
    type?: MCPServerLogType;
    limit?: number;
    offset?: number;
}): {
    logs: MCPServerLog[];
    total: number;
};
/**
 * 獲取最近的 MCP Server 錯誤日誌
 */
export declare function getRecentMCPServerErrors(serverId?: number, limit?: number): MCPServerLog[];
/**
 * 清理舊的 MCP Server 日誌（保留最近 N 天）
 */
export declare function cleanupOldMCPServerLogs(daysToKeep?: number): number;
export interface APILog {
    id: number;
    endpoint: string;
    method: string;
    statusCode: number;
    success: boolean;
    message: string | null;
    errorDetails: string | null;
    requestData: string | null;
    responseTimeMs: number | null;
    createdAt: string;
}
/**
 * 記錄 API 請求
 */
export declare function logAPIRequest(data: {
    endpoint: string;
    method: string;
    statusCode: number;
    success: boolean;
    message?: string;
    errorDetails?: string;
    requestData?: unknown;
    responseTimeMs?: number;
}): void;
/**
 * 記錄 API 錯誤（簡化版，用於向後兼容）
 */
export declare function logAPIError(data: {
    endpoint: string;
    method: string;
    errorMessage: string;
    errorDetails?: string;
    requestData?: unknown;
}): void;
/**
 * 查詢 API 日誌
 */
export declare function queryAPILogs(options: {
    endpoint?: string;
    successOnly?: boolean;
    errorsOnly?: boolean;
    limit?: number;
    offset?: number;
}): {
    logs: APILog[];
    total: number;
};
/**
 * 查詢 API 錯誤日誌（向後兼容）
 */
export declare function queryAPIErrorLogs(options: {
    endpoint?: string;
    limit?: number;
    offset?: number;
}): {
    logs: {
        id: number;
        endpoint: string;
        method: string;
        errorMessage: string;
        errorDetails: string | null;
        requestData: string | null;
        createdAt: string;
    }[];
    total: number;
};
/**
 * 清理舊的 API 日誌
 */
export declare function cleanupOldAPILogs(daysToKeep?: number): number;
/**
 * 清除所有 API 日誌
 */
export declare function clearAllAPILogs(): number;
/**
 * 清理舊的 API 錯誤日誌（向後兼容）
 */
export declare function cleanupOldAPIErrorLogs(daysToKeep?: number): number;
import type { CLISettings, CLISettingsRequest, CLITerminal, CLIExecutionLog } from '../types/index.js';
/**
 * 取得 CLI 設定
 */
export declare function getCLISettings(): CLISettings | null;
/**
 * 更新 CLI 設定
 */
export declare function updateCLISettings(settings: CLISettingsRequest): CLISettings | null;
/**
 * 建立 CLI 終端機記錄
 */
export declare function createCLITerminal(terminal: Omit<CLITerminal, 'startedAt' | 'lastActivityAt'>): CLITerminal | null;
/**
 * 取得單一 CLI 終端機
 */
export declare function getCLITerminalById(id: string): CLITerminal | null;
/**
 * 取得所有 CLI 終端機
 */
export declare function getCLITerminals(): CLITerminal[];
/**
 * 更新 CLI 終端機
 */
export declare function updateCLITerminal(id: string, data: Partial<Pick<CLITerminal, 'status' | 'lastActivityAt' | 'pid'>>): boolean;
/**
 * 刪除 CLI 終端機
 */
export declare function deleteCLITerminal(id: string): boolean;
/**
 * 更新終端機最後活動時間
 */
export declare function updateCLITerminalActivity(id: string): boolean;
/**
 * 新增 CLI 執行日誌
 */
export declare function insertCLIExecutionLog(log: Omit<CLIExecutionLog, 'id' | 'createdAt'>): number;
/**
 * 取得 CLI 執行日誌
 */
export declare function getCLIExecutionLogs(terminalId: string, limit?: number): CLIExecutionLog[];
/**
 * 清理舊的 CLI 執行日誌
 */
export declare function cleanupOldCLIExecutionLogs(daysToKeep?: number): number;
//# sourceMappingURL=database.d.ts.map