/**
 * SQLite 資料庫管理模組
 * 使用 better-sqlite3 進行資料持久化
 */
import Database from 'better-sqlite3';
import type { Prompt, CreatePromptRequest, UpdatePromptRequest, AISettings, AISettingsRequest, UserPreferences, LogEntry, LogQueryOptions, LogQueryResult, LogDeleteOptions, MCPServerConfig, CreateMCPServerRequest, UpdateMCPServerRequest } from '../types/index.js';
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
//# sourceMappingURL=database.d.ts.map