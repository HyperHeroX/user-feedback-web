/**
 * SQLite 資料庫管理模組
 * 使用 better-sqlite3 進行資料持久化
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { encrypt, decrypt } from './crypto-helper.js';
import { logger } from './logger.js';
import type {
    Prompt,
    CreatePromptRequest,
    UpdatePromptRequest,
    AISettings,
    AISettingsRequest,
    UserPreferences,
    LogEntry,
    LogQueryOptions,
    LogQueryResult,
    LogDeleteOptions,
    LogLevel,
    MCPServerConfig,
    CreateMCPServerRequest,
    UpdateMCPServerRequest,
    MCPTransportType,
    MCPServerLog,
    MCPServerLogType,
    SelfProbeSettings,
    SelfProbeSettingsRequest
} from '../types/index.js';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'feedback.db');

let db: Database.Database | null = null;

const SYSTEM_PROMPT_VERSIONS: Record<string, string> = {
    'v1': `你是一個有幫助的 AI 助手，專門協助使用者回應 AI 工作匯報。
請根據 AI 的工作匯報內容，生成簡潔、專業且有建設性的回應。
回應應該：
1. 確認 AI 完成的工作
2. 提供必要的反饋或建議
3. 如有需要，提出後續任務或改進方向

保持回應簡短（2-3句話），除非需要更詳細的說明。`,

    'v2': `你是一個有幫助的 AI 助手，專門協助使用者回應 AI 工作匯報。

你可以使用 MCP (Model Context Protocol) 工具來執行任務。當你需要使用工具時，請以下列 JSON 格式回應：

\`\`\`json
{
  "tool_calls": [
    {"name": "工具名稱", "arguments": {"參數名": "參數值"}}
  ],
  "message": "說明你正在做什麼"
}
\`\`\`

如果不需要使用工具，直接以純文字回應即可。

請根據 AI 的工作匯報內容，生成簡潔、專業且有建設性的回應。
回應應該：
1. 確認 AI 完成的工作
2. 提供必要的反饋或建議
3. 如有需要，提出後續任務或改進方向

保持回應簡短（2-3句話），除非需要更詳細的說明。`
};

const CURRENT_PROMPT_VERSION = 'v2';

function hashPrompt(prompt: string): string {
    return crypto.createHash('sha256').update(prompt.trim()).digest('hex').substring(0, 16);
}

function getOldVersionHashes(): string[] {
    return Object.entries(SYSTEM_PROMPT_VERSIONS)
        .filter(([version]) => version !== CURRENT_PROMPT_VERSION)
        .map(([, prompt]) => hashPrompt(prompt));
}

/**
 * 嘗試取得已初始化的資料庫，若無法載入 native 模組（例如在無法編譯 native addon 的環境），
 * 則回傳 null，呼叫端需妥善處理回傳為 null 的情況以降級處理。
 */
function tryGetDb(): Database.Database | null {
    try {
        if (!db) {
            return initDatabase();
        }
        return db;
    } catch (err) {
        // 記錄錯誤，並回傳 null 以便上層採取降級處理
        logger.error('Database unavailable:', err instanceof Error ? err.message : err);
        db = null;
        return null;
    }
}

/**
 * 初始化資料庫
 * 創建資料目錄和資料表
 */
export function initDatabase(): Database.Database {
    if (db) {
        return db;
    }

    // 確保 data 目錄存在
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }

    // 開啟或創建資料庫
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // 啟用 Write-Ahead Logging 以提升性能

    // 創建資料表
    createTables();

    // 插入預設設定
    initDefaultSettings();

    // 遷移系統提示詞（若使用舊版未修改的提示詞）
    migrateSystemPromptIfNeeded();

    // 遷移 MCP 工具提示詞（為現有記錄設定預設值）
    migrateMcpToolsPromptIfNeeded();

    return db;
}

/**
 * 創建資料表
 */
function createTables(): void {
    if (!db) throw new Error('Database not initialized');

    // 提示詞表
    db.exec(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      order_index INTEGER NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 創建索引以優化查詢
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_prompts_pinned_order 
    ON prompts(is_pinned DESC, order_index ASC)
  `);

    // AI 設定表
    db.exec(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      mcp_tools_prompt TEXT,
      temperature REAL,
      max_tokens INTEGER,
      auto_reply_timer_seconds INTEGER DEFAULT 300,
      max_tool_rounds INTEGER DEFAULT 5,
      debug_mode INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 遷移：為現有的ai_settings表添加auto_reply_timer_seconds列（如果不存在）
    try {
        const columnCheck = db.prepare(
            'PRAGMA table_info(ai_settings)'
        ).all() as Array<{ name: string }>;

        const hasAutoReplyColumn = columnCheck.some(col => col.name === 'auto_reply_timer_seconds');

        if (!hasAutoReplyColumn) {
            db.exec(`
                ALTER TABLE ai_settings 
                ADD COLUMN auto_reply_timer_seconds INTEGER DEFAULT 300
            `);
            logger.info('Successfully migrated ai_settings table - added auto_reply_timer_seconds column');
        }

        // 遷移：添加 mcp_tools_prompt 欄位
        const hasMcpToolsPromptColumn = columnCheck.some(col => col.name === 'mcp_tools_prompt');
        if (!hasMcpToolsPromptColumn) {
            db.exec(`
                ALTER TABLE ai_settings 
                ADD COLUMN mcp_tools_prompt TEXT
            `);
            logger.info('Successfully migrated ai_settings table - added mcp_tools_prompt column');
        }

        // 遷移：添加 max_tool_rounds 欄位 (AI 交談次數上限)
        const hasMaxToolRoundsColumn = columnCheck.some(col => col.name === 'max_tool_rounds');
        if (!hasMaxToolRoundsColumn) {
            db.exec(`
                ALTER TABLE ai_settings 
                ADD COLUMN max_tool_rounds INTEGER DEFAULT 5
            `);
            logger.info('Successfully migrated ai_settings table - added max_tool_rounds column');
        }

        // 遷移：添加 debug_mode 欄位 (Debug 模式)
        const hasDebugModeColumn = columnCheck.some(col => col.name === 'debug_mode');
        if (!hasDebugModeColumn) {
            db.exec(`
                ALTER TABLE ai_settings 
                ADD COLUMN debug_mode INTEGER DEFAULT 0
            `);
            logger.info('Successfully migrated ai_settings table - added debug_mode column');
        }
    } catch (error) {
        logger.warn('Migration check failed (may be normal for new DBs):', error);
    }

    // 使用者偏好設定表
    db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auto_reply_timeout INTEGER DEFAULT 300,
      enable_auto_reply INTEGER DEFAULT 0,
      theme TEXT DEFAULT 'light',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 日誌表
    db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      source TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 日誌表索引優化查詢
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_logs_source ON logs(source)
  `);

    // MCP Servers 表
    db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      transport TEXT NOT NULL,
      command TEXT,
      args TEXT,
      env TEXT,
      url TEXT,
      enabled INTEGER DEFAULT 1,
      deferred_startup INTEGER DEFAULT 0,
      startup_args_template TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // MCP Servers 索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled)
  `);

    // 遷移：為現有的 mcp_servers 表添加 deferred_startup 和 startup_args_template 列（如果不存在）
    try {
        const mcpColumnCheck = db.prepare(
            'PRAGMA table_info(mcp_servers)'
        ).all() as Array<{ name: string }>;

        const hasDeferredStartupColumn = mcpColumnCheck.some(col => col.name === 'deferred_startup');
        if (!hasDeferredStartupColumn) {
            db.exec(`ALTER TABLE mcp_servers ADD COLUMN deferred_startup INTEGER DEFAULT 0`);
            logger.info('Successfully migrated mcp_servers table - added deferred_startup column');
        }

        const hasStartupArgsTemplateColumn = mcpColumnCheck.some(col => col.name === 'startup_args_template');
        if (!hasStartupArgsTemplateColumn) {
            db.exec(`ALTER TABLE mcp_servers ADD COLUMN startup_args_template TEXT`);
            logger.info('Successfully migrated mcp_servers table - added startup_args_template column');
        }
    } catch (err) {
        logger.warn('Migration check for mcp_servers failed:', err);
    }

    // MCP Tool 啟用配置表
    db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_tool_enables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE,
      UNIQUE(server_id, tool_name)
    )
  `);

    // MCP Tool 啟用配置索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_enables_server ON mcp_tool_enables(server_id)
  `);

    // MCP Server 日誌表 - 記錄連線、錯誤等事件
    db.exec(`
    CREATE TABLE IF NOT EXISTS mcp_server_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      server_name TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE CASCADE
    )
  `);

    // MCP Server 日誌索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mcp_server_logs_server ON mcp_server_logs(server_id)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mcp_server_logs_type ON mcp_server_logs(type)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mcp_server_logs_created ON mcp_server_logs(created_at DESC)
  `);

    // CLI 設定表
    db.exec(`
    CREATE TABLE IF NOT EXISTS cli_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      ai_mode TEXT DEFAULT 'api',
      cli_tool TEXT DEFAULT 'gemini',
      cli_timeout INTEGER DEFAULT 120000,
      cli_fallback_to_api INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // CLI 終端機表
    db.exec(`
    CREATE TABLE IF NOT EXISTS cli_terminals (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      project_path TEXT NOT NULL,
      tool TEXT NOT NULL,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'idle',
      pid INTEGER
    )
  `);

    // CLI 終端機索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cli_terminals_status ON cli_terminals(status)
  `);

    // CLI 執行日誌表
    db.exec(`
    CREATE TABLE IF NOT EXISTS cli_execution_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      terminal_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT,
      execution_time INTEGER,
      success INTEGER DEFAULT 1,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (terminal_id) REFERENCES cli_terminals(id) ON DELETE CASCADE
    )
  `);

    // CLI 執行日誌索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cli_execution_logs_terminal ON cli_execution_logs(terminal_id)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cli_execution_logs_created ON cli_execution_logs(created_at DESC)
  `);

    // API 日誌表（記錄所有 API 請求）
    db.exec(`
    CREATE TABLE IF NOT EXISTS api_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      success INTEGER NOT NULL DEFAULT 1,
      message TEXT,
      error_details TEXT,
      request_data TEXT,
      response_time_ms INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // API 日誌索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_logs_success ON api_logs(success)
  `);
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC)
  `);

    // 兼容舊的 api_error_logs 表（如果存在則遷移數據）
    try {
        const hasOldTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_error_logs'").get();
        if (hasOldTable) {
            db.exec(`
                INSERT OR IGNORE INTO api_logs (endpoint, method, status_code, success, message, error_details, request_data, created_at)
                SELECT endpoint, method, 500, 0, error_message, error_details, request_data, created_at FROM api_error_logs
            `);
            db.exec(`DROP TABLE IF EXISTS api_error_logs`);
        }
    } catch {
        // 忽略遷移錯誤
    }

    // Self-Probe 設定表
    db.exec(`
    CREATE TABLE IF NOT EXISTS self_probe_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER DEFAULT 0,
      interval_seconds INTEGER DEFAULT 300,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Prompt Config 設定表
    db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      content TEXT,
      first_order INTEGER DEFAULT 0,
      second_order INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      editable INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // 初始化預設提示詞配置
    initDefaultPromptConfigs();
}

/**
 * 初始化預設設定
 */
function initDefaultSettings(): void {
    if (!db) throw new Error('Database not initialized');

    // 檢查是否已有設定
    const aiSettings = db.prepare('SELECT COUNT(*) as count FROM ai_settings').get() as { count: number };
    if (aiSettings.count === 0) {
        // 插入預設 AI 設定
        const defaultSystemPrompt = `你是一個有幫助的 AI 助手，專門協助使用者回應 AI 工作匯報。

你可以使用 MCP (Model Context Protocol) 工具來執行任務。當你需要使用工具時，請以下列 JSON 格式回應：

\`\`\`json
{
  "tool_calls": [
    {"name": "工具名稱", "arguments": {"參數名": "參數值"}}
  ],
  "message": "說明你正在做什麼"
}
\`\`\`

如果不需要使用工具，直接以純文字回應即可。

請根據 AI 的工作匯報內容，生成簡潔、專業且有建設性的回應。
回應應該：
1. 確認 AI 完成的工作
2. 提供必要的反饋或建議
3. 如有需要，提出後續任務或改進方向

保持回應簡短（2-3句話），除非需要更詳細的說明。`;

        const defaultMcpToolsPrompt = `## 專案背景資訊
當前專案: {project_name}
專案路徑: {project_path}

**重要指示**: 在回覆之前，你應該先使用 MCP 工具來查詢專案的背景資訊：
1. 專案的架構和結構（如使用 get_symbols_overview, list_dir 等）
2. 專案的開發計劃和規範（如讀取 openspec 目錄中的文件）
3. 當前的任務和進度

**路徑使用規則**: 在調用 MCP 工具時：
- 所有需要路徑參數的工具（如 list_dir, read_file, find_file 等）必須使用**完整的專案路徑 {project_path}** 作為基礎路徑
- 不要使用相對路徑如 "." 或 "./"，應使用完整路徑如 "{project_path}" 或 "{project_path}/src"
- 例如：list_dir 應使用 "directory": "{project_path}" 而非 "directory": "."

**請務必先調用工具查詢專案資訊**，然後根據查詢結果提供精確的回覆。

## MCP 工具使用說明

當你需要使用工具時，請回覆一個 JSON 格式的工具調用請求（不要有其他文字）：

\`\`\`json
{
  "tool_calls": [
    { "name": "工具名稱", "arguments": { "參數名": "參數值" } }
  ],
  "message": "說明你正在做什麼（可選）"
}
\`\`\`

工具執行後，結果會回傳給你。你可以繼續調用更多工具，或根據結果提供最終回覆。
當你不需要調用工具時，直接以純文字回覆即可。`;

        db.prepare(`
      INSERT INTO ai_settings (api_url, model, api_key, system_prompt, temperature, max_tokens, auto_reply_timer_seconds, mcp_tools_prompt, max_tool_rounds, debug_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            'https://generativelanguage.googleapis.com/v1beta',
            'gemini-2.0-flash-exp',
            encrypt('YOUR_API_KEY_HERE'), // 加密預設值
            defaultSystemPrompt,
            0.7,
            1000,
            300,
            defaultMcpToolsPrompt,
            5, // 預設 AI 交談次數
            0 // 預設 Debug 模式關閉
        );
    }

    // 檢查使用者偏好設定
    const preferences = db.prepare('SELECT COUNT(*) as count FROM user_preferences').get() as { count: number };
    if (preferences.count === 0) {
        db.prepare(`
      INSERT INTO user_preferences (auto_reply_timeout, enable_auto_reply, theme)
      VALUES (?, ?, ?)
    `).run(300, 0, 'light');
    }
}

function migrateSystemPromptIfNeeded(): void {
    if (!db) return;

    const row = db.prepare('SELECT id, system_prompt FROM ai_settings ORDER BY id DESC LIMIT 1').get() as { id: number; system_prompt: string } | undefined;
    if (!row) return;

    const currentHash = hashPrompt(row.system_prompt);
    const oldHashes = getOldVersionHashes();

    if (oldHashes.includes(currentHash)) {
        const newPrompt = SYSTEM_PROMPT_VERSIONS[CURRENT_PROMPT_VERSION];
        db.prepare('UPDATE ai_settings SET system_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newPrompt, row.id);
        logger.info(`[Database] 系統提示詞已自動升級至 ${CURRENT_PROMPT_VERSION}`);
    }
}

/**
 * 為現有記錄設定預設的 MCP 工具提示詞
 */
function migrateMcpToolsPromptIfNeeded(): void {
    if (!db) return;

    const row = db.prepare('SELECT id, mcp_tools_prompt FROM ai_settings ORDER BY id DESC LIMIT 1').get() as { id: number; mcp_tools_prompt: string | null } | undefined;
    if (!row) {
        logger.debug('[Database] 沒有找到 ai_settings 記錄，跳過 MCP 工具提示詞遷移');
        return;
    }

    logger.debug(`[Database] 當前 mcp_tools_prompt 值: ${row.mcp_tools_prompt === null ? 'NULL' : row.mcp_tools_prompt === '' ? '空字串' : '有值 (' + row.mcp_tools_prompt.length + ' 字元)'}`);

    // 如果已經有 mcp_tools_prompt 則不需要遷移
    if (row.mcp_tools_prompt && row.mcp_tools_prompt.trim() !== '') {
        logger.debug('[Database] MCP 工具提示詞已存在，跳過遷移');
        return;
    }

    const defaultMcpToolsPrompt = `## 專案背景資訊
當前專案: {project_name}
專案路徑: {project_path}

**重要指示**: 在回覆之前，你應該先使用 MCP 工具來查詢專案的背景資訊：
1. 專案的架構和結構（如使用 get_symbols_overview, list_dir 等）
2. 專案的開發計劃和規範（如讀取 openspec 目錄中的文件）
3. 當前的任務和進度

**路徑使用規則**: 在調用 MCP 工具時：
- 所有需要路徑參數的工具（如 list_dir, read_file, find_file 等）必須使用**完整的專案路徑 {project_path}** 作為基礎路徑
- 不要使用相對路徑如 "." 或 "./"，應使用完整路徑如 "{project_path}" 或 "{project_path}/src"
- 例如：list_dir 應使用 "directory": "{project_path}" 而非 "directory": "."

**請務必先調用工具查詢專案資訊**，然後根據查詢結果提供精確的回覆。

## MCP 工具使用說明

當你需要使用工具時，請回覆一個 JSON 格式的工具調用請求（不要有其他文字）：

\`\`\`json
{
  "tool_calls": [
    { "name": "工具名稱", "arguments": { "參數名": "參數值" } }
  ],
  "message": "說明你正在做什麼（可選）"
}
\`\`\`

工具執行後，結果會回傳給你。你可以繼續調用更多工具，或根據結果提供最終回覆。
當你不需要調用工具時，直接以純文字回覆即可。`;

    db.prepare('UPDATE ai_settings SET mcp_tools_prompt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(defaultMcpToolsPrompt, row.id);
    logger.info('[Database] MCP 工具提示詞已設定預設值');
}

/**
 * 關閉資料庫連接
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}

/**
 * 獲取資料庫實例
 */
export function getDatabase(): Database.Database {
    if (!db) {
        return initDatabase();
    }
    return db;
}

// ============ 提示詞管理 ============

/**
 * 獲取所有提示詞
 */
export function getAllPrompts(): Prompt[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
    SELECT 
      id, title, content, 
      is_pinned as isPinned, 
      order_index as orderIndex, 
      category,
      created_at as createdAt,
      updated_at as updatedAt
    FROM prompts
    ORDER BY is_pinned DESC, order_index ASC
  `).all();

    return rows.map(row => ({
        ...(row as any),
        isPinned: Boolean((row as any).isPinned)
    })) as Prompt[];
}

/**
 * 根據 ID 獲取提示詞
 */
export function getPromptById(id: number): Prompt | undefined {
    const db = tryGetDb();
    if (!db) return undefined;

    const row = db.prepare(`
    SELECT 
      id, title, content, 
      is_pinned as isPinned, 
      order_index as orderIndex, 
      category,
      created_at as createdAt,
      updated_at as updatedAt
    FROM prompts
    WHERE id = ?
  `).get(id);

    if (!row) return undefined;

    return {
        ...(row as any),
        isPinned: Boolean((row as any).isPinned)
    } as Prompt;
}

/**
 * 創建新提示詞
 */
export function createPrompt(data: CreatePromptRequest): Prompt {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    // 獲取當前最大的 order_index
    const maxOrder = db.prepare('SELECT MAX(order_index) as maxOrder FROM prompts').get() as { maxOrder: number | null };
    const orderIndex = (maxOrder.maxOrder ?? -1) + 1;

    const result = db.prepare(`
    INSERT INTO prompts (title, content, is_pinned, order_index, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(
        data.title,
        data.content,
        data.isPinned ? 1 : 0,
        orderIndex,
        data.category || null
    );

    const prompt = getPromptById(Number(result.lastInsertRowid));
    if (!prompt) throw new Error('Failed to create prompt');

    return prompt;
}

/**
 * 更新提示詞
 */
export function updatePrompt(id: number, data: UpdatePromptRequest): Prompt {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    // 構建動態 SQL
    const updates: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
        updates.push('title = ?');
        values.push(data.title);
    }
    if (data.content !== undefined) {
        updates.push('content = ?');
        values.push(data.content);
    }
    if (data.isPinned !== undefined) {
        updates.push('is_pinned = ?');
        values.push(data.isPinned ? 1 : 0);
    }
    if (data.orderIndex !== undefined) {
        updates.push('order_index = ?');
        values.push(data.orderIndex);
    }
    if (data.category !== undefined) {
        updates.push('category = ?');
        values.push(data.category);
    }

    if (updates.length === 0) {
        throw new Error('No fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
    UPDATE prompts
    SET ${updates.join(', ')}
    WHERE id = ?
  `).run(...values);

    const prompt = getPromptById(id);
    if (!prompt) throw new Error('Prompt not found');

    return prompt;
}

/**
 * 刪除提示詞
 */
export function deletePrompt(id: number): boolean {
    const db = tryGetDb();
    if (!db) return false;
    const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
    return result.changes > 0;
}

/**
 * 切換提示詞釘選狀態
 */
export function togglePromptPin(id: number): Prompt {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    const prompt = getPromptById(id);

    if (!prompt) throw new Error('Prompt not found');

    db.prepare(`
    UPDATE prompts
    SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(prompt.isPinned ? 0 : 1, id);

    const updated = getPromptById(id);
    if (!updated) throw new Error('Failed to update prompt');

    return updated;
}

/**
 * 調整提示詞順序
 */
export function reorderPrompts(prompts: Array<{ id: number; orderIndex: number }>): void {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    const updateStmt = db.prepare(`
    UPDATE prompts
    SET order_index = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

    const transaction = db.transaction((items: Array<{ id: number; orderIndex: number }>) => {
        for (const item of items) {
            updateStmt.run(item.orderIndex, item.id);
        }
    });

    transaction(prompts);
}

/**
 * 獲取釘選的提示詞（按順序）
 */
export function getPinnedPrompts(): Prompt[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
    SELECT 
      id, title, content, 
      is_pinned as isPinned, 
      order_index as orderIndex, 
      category,
      created_at as createdAt,
      updated_at as updatedAt
    FROM prompts
    WHERE is_pinned = 1
    ORDER BY order_index ASC
  `).all();

    return rows.map(row => ({
        ...(row as any),
        isPinned: true
    })) as Prompt[];
}

// ============ AI 設定管理 ============

/**
 * 獲取 AI 設定
 */
export function getAISettings(): AISettings | undefined {
    const db = tryGetDb();
    if (!db) return undefined;

    const row = db.prepare(`
    SELECT 
      id, api_url as apiUrl, model, api_key as apiKey, system_prompt as systemPrompt,
      mcp_tools_prompt as mcpToolsPrompt,
      temperature, max_tokens as maxTokens, auto_reply_timer_seconds as autoReplyTimerSeconds,
      max_tool_rounds as maxToolRounds, debug_mode as debugMode,
      created_at as createdAt, updated_at as updatedAt
    FROM ai_settings
    ORDER BY id DESC
    LIMIT 1
  `).get();

    if (!row) return undefined;

    const settings = row as any;

    // 解密 API Key
    try {
        const encryptedKey = settings.apiKey;
        logger.debug(`[Database] 嘗試解密 API Key, 加密格式: ${encryptedKey?.substring(0, 20)}...`);
        logger.debug(`[Database] 加密密碼是否已設置: ${!!process.env['MCP_ENCRYPTION_PASSWORD']}`);

        settings.apiKey = decrypt(settings.apiKey);

        logger.debug(`[Database] API Key 解密成功, 長度: ${settings.apiKey?.length}, 前綴: ${settings.apiKey?.substring(0, 3)}...`);
    } catch (error) {
        logger.error('[Database] Failed to decrypt API key:', error);
        logger.error(`[Database] 使用的加密密碼: ${process.env['MCP_ENCRYPTION_PASSWORD'] ? '已設置' : '未設置(使用預設值)'}`);
        settings.apiKey = '';
    }

    // SQLite INTEGER 轉換為 boolean
    if (settings.debugMode !== undefined) {
        settings.debugMode = Boolean(settings.debugMode);
    }

    return settings as AISettings;
}

/**
 * 更新 AI 設定
 */
export function updateAISettings(data: AISettingsRequest): AISettings {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    // 檢查是否已有設定
    const existing = db.prepare('SELECT id FROM ai_settings ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;

    if (existing) {
        // 更新現有設定
        const updates: string[] = [];
        const values: any[] = [];

        if (data.apiUrl !== undefined) {
            updates.push('api_url = ?');
            values.push(data.apiUrl);
        }
        if (data.model !== undefined) {
            updates.push('model = ?');
            values.push(data.model);
        }
        if (data.apiKey !== undefined) {
            updates.push('api_key = ?');
            logger.debug(`[Database] 加密 API Key, 原始長度: ${data.apiKey.length}, 前綴: ${data.apiKey.substring(0, 3)}...`);
            logger.debug(`[Database] 使用的加密密碼: ${process.env['MCP_ENCRYPTION_PASSWORD'] ? '已設置' : '未設置(使用預設值)'}`);
            const encrypted = encrypt(data.apiKey);
            logger.debug(`[Database] API Key 加密後格式: ${encrypted.substring(0, 20)}...`);
            values.push(encrypted); // 加密 API Key
        }
        if (data.systemPrompt !== undefined) {
            updates.push('system_prompt = ?');
            values.push(data.systemPrompt);
        }
        if (data.mcpToolsPrompt !== undefined) {
            updates.push('mcp_tools_prompt = ?');
            values.push(data.mcpToolsPrompt);
        }
        if (data.temperature !== undefined) {
            updates.push('temperature = ?');
            values.push(data.temperature);
        }
        if (data.maxTokens !== undefined) {
            updates.push('max_tokens = ?');
            values.push(data.maxTokens);
        }
        if (data.autoReplyTimerSeconds !== undefined) {
            updates.push('auto_reply_timer_seconds = ?');
            values.push(data.autoReplyTimerSeconds);
        }
        if (data.maxToolRounds !== undefined) {
            updates.push('max_tool_rounds = ?');
            values.push(data.maxToolRounds);
        }
        if (data.debugMode !== undefined) {
            updates.push('debug_mode = ?');
            values.push(data.debugMode ? 1 : 0); // SQLite 布爾值轉換為 INTEGER
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(existing.id);

            try {
                db.prepare(`
        UPDATE ai_settings
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);
            } catch (err) {
                // 包裝並重新拋出具備細節的錯誤
                const error = err instanceof Error ? err : new Error(String(err));
                throw new Error(`Failed to update AI settings: ${error.message}\n${error.stack || ''}`);
            }
        }
    } else {
        // 創建新設定
        db.prepare(`
      INSERT INTO ai_settings (api_url, model, api_key, system_prompt, mcp_tools_prompt, temperature, max_tokens, auto_reply_timer_seconds, max_tool_rounds, debug_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            data.apiUrl || 'https://generativelanguage.googleapis.com/v1beta',
            data.model || 'gemini-2.0-flash-exp',
            data.apiKey ? encrypt(data.apiKey) : encrypt('YOUR_API_KEY_HERE'),
            data.systemPrompt || '',
            data.mcpToolsPrompt || null,
            data.temperature ?? 0.7,
            data.maxTokens ?? 1000,
            data.autoReplyTimerSeconds ?? 300,
            data.maxToolRounds ?? 5,
            data.debugMode ? 1 : 0 // SQLite 布爾值轉換為 INTEGER
        );
    }

    const settings = getAISettings();
    if (!settings) throw new Error('Failed to get AI settings');

    return settings;
}

// ============ 使用者偏好設定管理 ============

/**
 * 獲取使用者偏好設定
 */
export function getUserPreferences(): UserPreferences {
    const db = tryGetDb();
    if (!db) {
        return {
            id: 0,
            autoReplyTimeout: 300,
            enableAutoReply: false,
            theme: 'light',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    const row = db.prepare(`
    SELECT 
      id,
      auto_reply_timeout as autoReplyTimeout,
      enable_auto_reply as enableAutoReply,
      theme,
      created_at as createdAt,
      updated_at as updatedAt
    FROM user_preferences
    ORDER BY id DESC
    LIMIT 1
  `).get();

    if (!row) {
        // 返回預設值
        return {
            id: 0,
            autoReplyTimeout: 300,
            enableAutoReply: false,
            theme: 'light',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    const prefs = row as any;
    return {
        ...prefs,
        enableAutoReply: Boolean(prefs.enableAutoReply)
    } as UserPreferences;
}

/**
 * 更新使用者偏好設定
 */
export function updateUserPreferences(data: Partial<Omit<UserPreferences, 'id' | 'createdAt' | 'updatedAt'>>): UserPreferences {
    const db = tryGetDb();
    if (!db) {
        // 無法存取資料庫，回傳預設偏好（但不儲存）
        return {
            id: 0,
            autoReplyTimeout: data.autoReplyTimeout ?? 300,
            enableAutoReply: data.enableAutoReply ?? false,
            theme: data.theme || 'light',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    const existing = db.prepare('SELECT id FROM user_preferences ORDER BY id DESC LIMIT 1').get() as { id: number } | undefined;

    if (existing) {
        const updates: string[] = [];
        const values: any[] = [];

        if (data.autoReplyTimeout !== undefined) {
            updates.push('auto_reply_timeout = ?');
            values.push(data.autoReplyTimeout);
        }
        if (data.enableAutoReply !== undefined) {
            updates.push('enable_auto_reply = ?');
            values.push(data.enableAutoReply ? 1 : 0);
        }
        if (data.theme !== undefined) {
            updates.push('theme = ?');
            values.push(data.theme);
        }

        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(existing.id);

            db.prepare(`
        UPDATE user_preferences
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);
        }
    } else {
        db.prepare(`
      INSERT INTO user_preferences (auto_reply_timeout, enable_auto_reply, theme)
      VALUES (?, ?, ?)
    `).run(
            data.autoReplyTimeout ?? 300,
            data.enableAutoReply ? 1 : 0,
            data.theme || 'light'
        );
    }

    return getUserPreferences();
}

// ============ 日誌資料庫操作 ============

/**
 * 插入單筆日誌
 */
export function insertLog(log: Omit<LogEntry, 'id'>): void {
    const db = tryGetDb();
    if (!db) return; // 無法存取資料庫時靜默失敗

    try {
        db.prepare(`
            INSERT INTO logs (level, message, context, source, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            log.level,
            log.message,
            log.context || null,
            log.source || null,
            log.createdAt || new Date().toISOString()
        );
    } catch (error) {
        // 寫入日誌失敗時使用 stderr，避免遞迴
        process.stderr.write(`[Database] Failed to insert log: ${error}\n`);
    }
}

/**
 * 批次插入日誌
 */
export function insertLogs(logs: Omit<LogEntry, 'id'>[]): void {
    const db = tryGetDb();
    if (!db || logs.length === 0) return;

    try {
        const insert = db.prepare(`
            INSERT INTO logs (level, message, context, source, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((logs: Omit<LogEntry, 'id'>[]) => {
            for (const log of logs) {
                insert.run(
                    log.level,
                    log.message,
                    log.context || null,
                    log.source || null,
                    log.createdAt || new Date().toISOString()
                );
            }
        });

        insertMany(logs);
    } catch (error) {
        process.stderr.write(`[Database] Failed to insert logs batch: ${error}\n`);
    }
}

/**
 * 查詢日誌
 */
export function queryLogs(options: LogQueryOptions = {}): LogQueryResult {
    const db = tryGetDb();
    if (!db) {
        return {
            logs: [],
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 }
        };
    }

    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const offset = (page - 1) * limit;

    // 構建 WHERE 條件
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.level) {
        conditions.push('level = ?');
        params.push(options.level);
    }

    if (options.source) {
        conditions.push('source = ?');
        params.push(options.source);
    }

    if (options.search) {
        conditions.push('(message LIKE ? OR context LIKE ?)');
        const searchPattern = `%${options.search}%`;
        params.push(searchPattern, searchPattern);
    }

    if (options.startDate) {
        conditions.push('created_at >= ?');
        params.push(options.startDate);
    }

    if (options.endDate) {
        conditions.push('created_at <= ?');
        params.push(options.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 計算總數
    const countSql = `SELECT COUNT(*) as total FROM logs ${whereClause}`;
    const countResult = db.prepare(countSql).get(...params) as { total: number };
    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);

    // 查詢日誌
    const querySql = `
        SELECT id, level, message, context, source, created_at as timestamp
        FROM logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;
    const logs = db.prepare(querySql).all(...params, limit, offset) as LogEntry[];

    return {
        logs,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
}

/**
 * 刪除日誌
 */
export function deleteLogs(options: LogDeleteOptions = {}): number {
    const db = tryGetDb();
    if (!db) return 0;

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.beforeDate) {
        conditions.push('created_at < ?');
        params.push(options.beforeDate);
    }

    if (options.level) {
        conditions.push('level = ?');
        params.push(options.level);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `DELETE FROM logs ${whereClause}`;

    try {
        const result = db.prepare(sql).run(...params);
        return result.changes;
    } catch (error) {
        process.stderr.write(`[Database] Failed to delete logs: ${error}\n`);
        return 0;
    }
}

/**
 * 清理過期日誌
 * @param retentionDays 保留天數，預設 30 天
 */
export function cleanupOldLogs(retentionDays: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    return deleteLogs({ beforeDate: cutoffDate.toISOString() });
}

/**
 * 獲取日誌來源列表（用於篩選下拉選單）
 */
export function getLogSources(): string[] {
    const db = tryGetDb();
    if (!db) return [];

    try {
        const results = db.prepare(`
            SELECT DISTINCT source FROM logs WHERE source IS NOT NULL ORDER BY source
        `).all() as { source: string }[];

        return results.map(r => r.source);
    } catch (error) {
        return [];
    }
}

// ============ MCP Servers 管理 ============

/**
 * 獲取所有 MCP Servers
 */
export function getAllMCPServers(): MCPServerConfig[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled, deferred_startup, startup_args_template,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        ORDER BY id ASC
    `).all() as any[];

    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        deferredStartup: Boolean(row.deferred_startup),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined,
        startupArgsTemplate: row.startup_args_template ? JSON.parse(row.startup_args_template) : undefined
    }));
}

/**
 * 獲取已啟用的 MCP Servers
 */
export function getEnabledMCPServers(): MCPServerConfig[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled, deferred_startup, startup_args_template,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        WHERE enabled = 1
        ORDER BY id ASC
    `).all() as any[];

    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        deferredStartup: Boolean(row.deferred_startup),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined,
        startupArgsTemplate: row.startup_args_template ? JSON.parse(row.startup_args_template) : undefined
    }));
}

/**
 * 獲取已啟用的非延遲啟動 MCP Servers
 */
export function getEnabledNonDeferredMCPServers(): MCPServerConfig[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled, deferred_startup, startup_args_template,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        WHERE enabled = 1 AND (deferred_startup = 0 OR deferred_startup IS NULL)
        ORDER BY id ASC
    `).all() as any[];

    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        deferredStartup: Boolean(row.deferred_startup),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined,
        startupArgsTemplate: row.startup_args_template ? JSON.parse(row.startup_args_template) : undefined
    }));
}

/**
 * 獲取已啟用的延遲啟動 MCP Servers
 */
export function getDeferredMCPServers(): MCPServerConfig[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled, deferred_startup, startup_args_template,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        WHERE enabled = 1 AND deferred_startup = 1
        ORDER BY id ASC
    `).all() as any[];

    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        deferredStartup: Boolean(row.deferred_startup),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined,
        startupArgsTemplate: row.startup_args_template ? JSON.parse(row.startup_args_template) : undefined
    }));
}

/**
 * 根據 ID 獲取 MCP Server
 */
export function getMCPServerById(id: number): MCPServerConfig | null {
    const db = tryGetDb();
    if (!db) return null;

    const row = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled, deferred_startup, startup_args_template,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        WHERE id = ?
    `).get(id) as any;

    if (!row) return null;

    return {
        ...row,
        enabled: Boolean(row.enabled),
        deferredStartup: Boolean(row.deferred_startup),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined,
        startupArgsTemplate: row.startup_args_template ? JSON.parse(row.startup_args_template) : undefined
    };
}

/**
 * 創建 MCP Server
 */
export function createMCPServer(data: CreateMCPServerRequest): MCPServerConfig {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    const result = db.prepare(`
        INSERT INTO mcp_servers (name, transport, command, args, env, url, enabled, deferred_startup, startup_args_template)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.name,
        data.transport,
        data.command || null,
        data.args ? JSON.stringify(data.args) : null,
        data.env ? JSON.stringify(data.env) : null,
        data.url || null,
        data.enabled !== false ? 1 : 0,
        data.deferredStartup ? 1 : 0,
        data.startupArgsTemplate ? JSON.stringify(data.startupArgsTemplate) : null
    );

    const server = getMCPServerById(result.lastInsertRowid as number);
    if (!server) throw new Error('Failed to create MCP Server');

    logger.info(`創建 MCP Server: ${data.name} (ID: ${server.id})`);
    return server;
}

/**
 * 更新 MCP Server
 */
export function updateMCPServer(id: number, data: UpdateMCPServerRequest): MCPServerConfig {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    const existing = getMCPServerById(id);
    if (!existing) throw new Error(`MCP Server ${id} 不存在`);

    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
    }
    if (data.transport !== undefined) {
        updates.push('transport = ?');
        params.push(data.transport);
    }
    if (data.command !== undefined) {
        updates.push('command = ?');
        params.push(data.command || null);
    }
    if (data.args !== undefined) {
        updates.push('args = ?');
        params.push(data.args ? JSON.stringify(data.args) : null);
    }
    if (data.env !== undefined) {
        updates.push('env = ?');
        params.push(data.env ? JSON.stringify(data.env) : null);
    }
    if (data.url !== undefined) {
        updates.push('url = ?');
        params.push(data.url || null);
    }
    if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        params.push(data.enabled ? 1 : 0);
    }
    if (data.deferredStartup !== undefined) {
        updates.push('deferred_startup = ?');
        params.push(data.deferredStartup ? 1 : 0);
    }
    if (data.startupArgsTemplate !== undefined) {
        updates.push('startup_args_template = ?');
        params.push(data.startupArgsTemplate ? JSON.stringify(data.startupArgsTemplate) : null);
    }

    if (updates.length === 0) {
        return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`
        UPDATE mcp_servers
        SET ${updates.join(', ')}
        WHERE id = ?
    `).run(...params);

    const updated = getMCPServerById(id);
    if (!updated) throw new Error('Failed to update MCP Server');

    logger.info(`更新 MCP Server: ${updated.name} (ID: ${id})`);
    return updated;
}

/**
 * 刪除 MCP Server
 */
export function deleteMCPServer(id: number): boolean {
    const db = tryGetDb();
    if (!db) return false;

    const existing = getMCPServerById(id);
    if (!existing) return false;

    const result = db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(id);

    if (result.changes > 0) {
        logger.info(`刪除 MCP Server: ${existing.name} (ID: ${id})`);
        return true;
    }

    return false;
}

/**
 * 切換 MCP Server 啟用狀態
 */
export function toggleMCPServerEnabled(id: number): MCPServerConfig {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    const existing = getMCPServerById(id);
    if (!existing) throw new Error(`MCP Server ${id} 不存在`);

    db.prepare(`
        UPDATE mcp_servers
        SET enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(existing.enabled ? 0 : 1, id);

    const updated = getMCPServerById(id);
    if (!updated) throw new Error('Failed to toggle MCP Server');

    logger.info(`切換 MCP Server 啟用狀態: ${updated.name} (ID: ${id}) -> ${updated.enabled ? '啟用' : '停用'}`);
    return updated;
}

// ============ MCP Tool 啟用配置 ============

/**
 * 獲取 Server 的工具啟用配置
 */
export function getToolEnableConfigs(serverId: number): Map<string, boolean> {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    const rows = db.prepare(`
        SELECT tool_name, enabled FROM mcp_tool_enables WHERE server_id = ?
    `).all(serverId) as Array<{ tool_name: string; enabled: number }>;

    const configs = new Map<string, boolean>();
    for (const row of rows) {
        configs.set(row.tool_name, row.enabled === 1);
    }
    return configs;
}

/**
 * 設定單一工具的啟用狀態
 */
export function setToolEnabled(serverId: number, toolName: string, enabled: boolean): void {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    db.prepare(`
        INSERT INTO mcp_tool_enables (server_id, tool_name, enabled)
        VALUES (?, ?, ?)
        ON CONFLICT(server_id, tool_name) DO UPDATE SET
            enabled = excluded.enabled,
            updated_at = CURRENT_TIMESTAMP
    `).run(serverId, toolName, enabled ? 1 : 0);

    logger.info(`設定工具啟用狀態: Server ${serverId}, 工具 ${toolName} -> ${enabled ? '啟用' : '停用'}`);
}

/**
 * 批次設定工具啟用狀態
 */
export function batchSetToolEnabled(
    serverId: number,
    tools: Array<{ toolName: string; enabled: boolean }>
): void {
    const db = tryGetDb();
    if (!db) throw new Error('Database unavailable');

    const stmt = db.prepare(`
        INSERT INTO mcp_tool_enables (server_id, tool_name, enabled)
        VALUES (?, ?, ?)
        ON CONFLICT(server_id, tool_name) DO UPDATE SET
            enabled = excluded.enabled,
            updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = db.transaction(() => {
        for (const tool of tools) {
            stmt.run(serverId, tool.toolName, tool.enabled ? 1 : 0);
        }
    });

    transaction();
    logger.info(`批次設定工具啟用狀態: Server ${serverId}, 共 ${tools.length} 個工具`);
}

/**
 * 檢查工具是否啟用（預設啟用）
 */
export function isToolEnabled(serverId: number, toolName: string): boolean {
    const db = tryGetDb();
    if (!db) return true;

    const row = db.prepare(`
        SELECT enabled FROM mcp_tool_enables WHERE server_id = ? AND tool_name = ?
    `).get(serverId, toolName) as { enabled: number } | undefined;

    return row ? row.enabled === 1 : true;
}

/**
 * 刪除 Server 的所有工具配置（在刪除 Server 時使用）
 */
export function deleteToolEnableConfigs(serverId: number): void {
    const db = tryGetDb();
    if (!db) return;

    db.prepare('DELETE FROM mcp_tool_enables WHERE server_id = ?').run(serverId);
    logger.info(`刪除工具啟用配置: Server ${serverId}`);
}

// ============ MCP Server 日誌相關函數 ============

/**
 * 插入 MCP Server 日誌
 */
export function insertMCPServerLog(log: Omit<MCPServerLog, 'id' | 'createdAt'>): void {
    const db = tryGetDb();
    if (!db) return;

    try {
        db.prepare(`
            INSERT INTO mcp_server_logs (server_id, server_name, type, message, details)
            VALUES (?, ?, ?, ?, ?)
        `).run(
            log.serverId,
            log.serverName,
            log.type,
            log.message,
            log.details || null
        );
    } catch (error) {
        process.stderr.write(`[Database] Failed to insert MCP server log: ${error}\n`);
    }
}

/**
 * 查詢 MCP Server 日誌
 */
export function queryMCPServerLogs(options: {
    serverId?: number;
    type?: MCPServerLogType;
    limit?: number;
    offset?: number;
}): { logs: MCPServerLog[]; total: number } {
    const db = tryGetDb();
    if (!db) return { logs: [], total: 0 };

    const conditions: string[] = [];
    const params: (number | string)[] = [];

    if (options.serverId !== undefined) {
        conditions.push('server_id = ?');
        params.push(options.serverId);
    }

    if (options.type) {
        conditions.push('type = ?');
        params.push(options.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`
        SELECT COUNT(*) as total FROM mcp_server_logs ${whereClause}
    `).get(...params) as { total: number };

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    const rows = db.prepare(`
        SELECT 
            id, server_id as serverId, server_name as serverName, 
            type, message, details, created_at as createdAt
        FROM mcp_server_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as MCPServerLog[];

    return {
        logs: rows,
        total: countRow.total
    };
}

/**
 * 獲取最近的 MCP Server 錯誤日誌
 */
export function getRecentMCPServerErrors(serverId?: number, limit: number = 50): MCPServerLog[] {
    const db = tryGetDb();
    if (!db) return [];

    if (serverId !== undefined) {
        return db.prepare(`
            SELECT 
                id, server_id as serverId, server_name as serverName, 
                type, message, details, created_at as createdAt
            FROM mcp_server_logs
            WHERE server_id = ? AND type = 'error'
            ORDER BY created_at DESC
            LIMIT ?
        `).all(serverId, limit) as MCPServerLog[];
    }

    return db.prepare(`
        SELECT 
            id, server_id as serverId, server_name as serverName, 
            type, message, details, created_at as createdAt
        FROM mcp_server_logs
        WHERE type = 'error'
        ORDER BY created_at DESC
        LIMIT ?
    `).all(limit) as MCPServerLog[];
}

/**
 * 清理舊的 MCP Server 日誌（保留最近 N 天）
 */
export function cleanupOldMCPServerLogs(daysToKeep: number = 7): number {
    const db = tryGetDb();
    if (!db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = db.prepare(`
        DELETE FROM mcp_server_logs WHERE created_at < ?
    `).run(cutoffDate.toISOString());

    return result.changes;
}

// ==================== API 日誌操作 ====================

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
export function logAPIRequest(data: {
    endpoint: string;
    method: string;
    statusCode: number;
    success: boolean;
    message?: string;
    errorDetails?: string;
    requestData?: unknown;
    responseTimeMs?: number;
}): void {
    const db = tryGetDb();
    if (!db) return;

    db.prepare(`
        INSERT INTO api_logs (endpoint, method, status_code, success, message, error_details, request_data, response_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        data.endpoint,
        data.method,
        data.statusCode,
        data.success ? 1 : 0,
        data.message || null,
        data.errorDetails || null,
        data.requestData ? JSON.stringify(data.requestData) : null,
        data.responseTimeMs || null
    );
}

/**
 * 記錄 API 錯誤（簡化版，用於向後兼容）
 */
export function logAPIError(data: {
    endpoint: string;
    method: string;
    errorMessage: string;
    errorDetails?: string;
    requestData?: unknown;
}): void {
    const requestData: {
        endpoint: string;
        method: string;
        statusCode: number;
        success: boolean;
        message: string;
        errorDetails?: string;
        requestData?: unknown;
    } = {
        endpoint: data.endpoint,
        method: data.method,
        statusCode: 500,
        success: false,
        message: data.errorMessage,
    };
    if (data.errorDetails) {
        requestData.errorDetails = data.errorDetails;
    }
    if (data.requestData !== undefined) {
        requestData.requestData = data.requestData;
    }
    logAPIRequest(requestData);
}

/**
 * 查詢 API 日誌
 */
export function queryAPILogs(options: {
    endpoint?: string;
    successOnly?: boolean;
    errorsOnly?: boolean;
    limit?: number;
    offset?: number;
}): { logs: APILog[]; total: number } {
    const db = tryGetDb();
    if (!db) return { logs: [], total: 0 };

    const { endpoint, successOnly, errorsOnly, limit = 100, offset = 0 } = options;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (endpoint) {
        conditions.push('endpoint = ?');
        params.push(endpoint);
    }

    if (successOnly) {
        conditions.push('success = 1');
    } else if (errorsOnly) {
        conditions.push('success = 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = db.prepare(`
        SELECT COUNT(*) as count FROM api_logs ${whereClause}
    `).get(...params) as { count: number };

    const logs = db.prepare(`
        SELECT 
            id,
            endpoint,
            method,
            status_code as statusCode,
            success,
            message,
            error_details as errorDetails,
            request_data as requestData,
            response_time_ms as responseTimeMs,
            created_at as createdAt
        FROM api_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as (Omit<APILog, 'success'> & { success: number })[];

    return {
        logs: logs.map(log => ({ ...log, success: log.success === 1 })),
        total: countResult.count
    };
}

/**
 * 查詢 API 錯誤日誌（向後兼容）
 */
export function queryAPIErrorLogs(options: {
    endpoint?: string;
    limit?: number;
    offset?: number;
}): { logs: { id: number; endpoint: string; method: string; errorMessage: string; errorDetails: string | null; requestData: string | null; createdAt: string }[]; total: number } {
    const result = queryAPILogs({ ...options, errorsOnly: true });
    return {
        logs: result.logs.map(log => ({
            id: log.id,
            endpoint: log.endpoint,
            method: log.method,
            errorMessage: log.message || 'Unknown error',
            errorDetails: log.errorDetails,
            requestData: log.requestData,
            createdAt: log.createdAt,
        })),
        total: result.total
    };
}

/**
 * 清理舊的 API 日誌
 */
export function cleanupOldAPILogs(daysToKeep: number = 7): number {
    const db = tryGetDb();
    if (!db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = db.prepare(`
        DELETE FROM api_logs WHERE created_at < ?
    `).run(cutoffDate.toISOString());

    return result.changes;
}

/**
 * 清除所有 API 日誌
 */
export function clearAllAPILogs(): number {
    const db = tryGetDb();
    if (!db) return 0;

    const result = db.prepare(`DELETE FROM api_logs`).run();
    return result.changes;
}

/**
 * 清理舊的 API 錯誤日誌（向後兼容）
 */
export function cleanupOldAPIErrorLogs(daysToKeep: number = 7): number {
    return cleanupOldAPILogs(daysToKeep);
}

// ==================== CLI 設定操作 ====================

import type { CLISettings, CLISettingsRequest, CLITerminal, CLIExecutionLog, AIMode, CLIToolType, CLITerminalStatus } from '../types/index.js';

/**
 * 取得 CLI 設定
 */
export function getCLISettings(): CLISettings | null {
    const db = tryGetDb();
    if (!db) return null;

    const row = db.prepare(`
        SELECT 
            id,
            ai_mode as aiMode,
            cli_tool as cliTool,
            cli_timeout as cliTimeout,
            cli_fallback_to_api as cliFallbackToApi,
            created_at as createdAt,
            updated_at as updatedAt
        FROM cli_settings
        WHERE id = 1
    `).get() as { id: number; aiMode: string; cliTool: string; cliTimeout: number; cliFallbackToApi: number; createdAt: string; updatedAt: string } | undefined;

    if (!row) {
        // 初始化預設設定
        db.prepare(`
            INSERT OR IGNORE INTO cli_settings (id, ai_mode, cli_tool, cli_timeout, cli_fallback_to_api)
            VALUES (1, 'api', 'gemini', 120000, 1)
        `).run();

        return {
            id: 1,
            aiMode: 'api' as AIMode,
            cliTool: 'gemini' as CLIToolType,
            cliTimeout: 120000,
            cliFallbackToApi: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    return {
        ...row,
        aiMode: row.aiMode as AIMode,
        cliTool: row.cliTool as CLIToolType,
        cliFallbackToApi: row.cliFallbackToApi === 1
    };
}

/**
 * 更新 CLI 設定
 */
export function updateCLISettings(settings: CLISettingsRequest): CLISettings | null {
    const db = tryGetDb();
    if (!db) return null;

    const current = getCLISettings();
    if (!current) return null;

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (settings.aiMode !== undefined) {
        updates.push('ai_mode = ?');
        params.push(settings.aiMode);
    }
    if (settings.cliTool !== undefined) {
        updates.push('cli_tool = ?');
        params.push(settings.cliTool);
    }
    if (settings.cliTimeout !== undefined) {
        updates.push('cli_timeout = ?');
        params.push(settings.cliTimeout);
    }
    if (settings.cliFallbackToApi !== undefined) {
        updates.push('cli_fallback_to_api = ?');
        params.push(settings.cliFallbackToApi ? 1 : 0);
    }

    if (updates.length === 0) return current;

    updates.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(1); // id

    db.prepare(`
        UPDATE cli_settings SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    return getCLISettings();
}

// ==================== CLI 終端機操作 ====================

/**
 * 建立 CLI 終端機記錄
 */
export function createCLITerminal(terminal: Omit<CLITerminal, 'startedAt' | 'lastActivityAt'>): CLITerminal | null {
    const db = tryGetDb();
    if (!db) return null;

    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO cli_terminals (id, project_name, project_path, tool, started_at, last_activity_at, status, pid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        terminal.id,
        terminal.projectName,
        terminal.projectPath,
        terminal.tool,
        now,
        now,
        terminal.status,
        terminal.pid || null
    );

    return getCLITerminalById(terminal.id);
}

/**
 * 取得單一 CLI 終端機
 */
export function getCLITerminalById(id: string): CLITerminal | null {
    const db = tryGetDb();
    if (!db) return null;

    const row = db.prepare(`
        SELECT 
            id,
            project_name as projectName,
            project_path as projectPath,
            tool,
            started_at as startedAt,
            last_activity_at as lastActivityAt,
            status,
            pid
        FROM cli_terminals
        WHERE id = ?
    `).get(id) as { id: string; projectName: string; projectPath: string; tool: string; startedAt: string; lastActivityAt: string; status: string; pid: number | null } | undefined;

    if (!row) return null;

    return {
        ...row,
        tool: row.tool as CLIToolType,
        status: row.status as CLITerminalStatus,
        pid: row.pid ?? undefined
    };
}

/**
 * 取得所有 CLI 終端機
 */
export function getCLITerminals(): CLITerminal[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
        SELECT 
            id,
            project_name as projectName,
            project_path as projectPath,
            tool,
            started_at as startedAt,
            last_activity_at as lastActivityAt,
            status,
            pid
        FROM cli_terminals
        ORDER BY last_activity_at DESC
    `).all() as Array<{ id: string; projectName: string; projectPath: string; tool: string; startedAt: string; lastActivityAt: string; status: string; pid: number | null }>;

    return rows.map(row => ({
        ...row,
        tool: row.tool as CLIToolType,
        status: row.status as CLITerminalStatus,
        pid: row.pid ?? undefined
    }));
}

/**
 * 更新 CLI 終端機
 */
export function updateCLITerminal(id: string, data: Partial<Pick<CLITerminal, 'status' | 'lastActivityAt' | 'pid'>>): boolean {
    const db = tryGetDb();
    if (!db) return false;

    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.status !== undefined) {
        updates.push('status = ?');
        params.push(data.status);
    }
    if (data.lastActivityAt !== undefined) {
        updates.push('last_activity_at = ?');
        params.push(data.lastActivityAt);
    }
    if (data.pid !== undefined) {
        updates.push('pid = ?');
        params.push(data.pid ?? null);
    }

    if (updates.length === 0) return false;

    params.push(id);

    const result = db.prepare(`
        UPDATE cli_terminals SET ${updates.join(', ')} WHERE id = ?
    `).run(...params);

    return result.changes > 0;
}

/**
 * 刪除 CLI 終端機
 */
export function deleteCLITerminal(id: string): boolean {
    const db = tryGetDb();
    if (!db) return false;

    const result = db.prepare(`
        DELETE FROM cli_terminals WHERE id = ?
    `).run(id);

    return result.changes > 0;
}

/**
 * 更新終端機最後活動時間
 */
export function updateCLITerminalActivity(id: string): boolean {
    return updateCLITerminal(id, { lastActivityAt: new Date().toISOString() });
}

// ==================== CLI 執行日誌操作 ====================

/**
 * 新增 CLI 執行日誌
 */
export function insertCLIExecutionLog(log: Omit<CLIExecutionLog, 'id' | 'createdAt'>): number {
    const db = tryGetDb();
    if (!db) return -1;

    const result = db.prepare(`
        INSERT INTO cli_execution_logs (terminal_id, prompt, response, execution_time, success, error)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        log.terminalId,
        log.prompt,
        log.response,
        log.executionTime,
        log.success ? 1 : 0,
        log.error || null
    );

    // 同時更新終端機最後活動時間
    updateCLITerminalActivity(log.terminalId);

    return result.lastInsertRowid as number;
}

/**
 * 取得 CLI 執行日誌
 */
export function getCLIExecutionLogs(terminalId: string, limit: number = 50): CLIExecutionLog[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
        SELECT 
            id,
            terminal_id as terminalId,
            prompt,
            response,
            execution_time as executionTime,
            success,
            error,
            created_at as createdAt
        FROM cli_execution_logs
        WHERE terminal_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(terminalId, limit) as Array<{ id: number; terminalId: string; prompt: string; response: string | null; executionTime: number; success: number; error: string | null; createdAt: string }>;

    return rows.map(row => ({
        ...row,
        success: row.success === 1,
        error: row.error ?? undefined
    }));
}

/**
 * 清理舊的 CLI 執行日誌
 */
export function cleanupOldCLIExecutionLogs(daysToKeep: number = 7): number {
    const db = tryGetDb();
    if (!db) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = db.prepare(`
        DELETE FROM cli_execution_logs WHERE created_at < ?
    `).run(cutoffDate.toISOString());

    return result.changes;
}

// ==================== Self-Probe Settings ====================

/**
 * 獲取 Self-Probe 設定
 */
export function getSelfProbeSettings(): SelfProbeSettings | undefined {
    const db = tryGetDb();
    if (!db) return undefined;

    const row = db.prepare(`
        SELECT 
            id,
            enabled,
            interval_seconds as intervalSeconds,
            updated_at as updatedAt
        FROM self_probe_settings
        WHERE id = 1
    `).get() as { id: number; enabled: number; intervalSeconds: number; updatedAt: string } | undefined;

    if (!row) return undefined;

    return {
        id: row.id,
        enabled: row.enabled === 1,
        intervalSeconds: row.intervalSeconds,
        updatedAt: row.updatedAt
    };
}

/**
 * 儲存 Self-Probe 設定
 */
export function saveSelfProbeSettings(settings: SelfProbeSettingsRequest): SelfProbeSettings {
    const db = tryGetDb();
    if (!db) throw new Error('Database not initialized');

    const existing = getSelfProbeSettings();
    const now = new Date().toISOString();

    if (existing) {
        db.prepare(`
            UPDATE self_probe_settings
            SET enabled = COALESCE(?, enabled),
                interval_seconds = COALESCE(?, interval_seconds),
                updated_at = ?
            WHERE id = 1
        `).run(
            settings.enabled !== undefined ? (settings.enabled ? 1 : 0) : null,
            settings.intervalSeconds ?? null,
            now
        );
    } else {
        db.prepare(`
            INSERT INTO self_probe_settings (id, enabled, interval_seconds, updated_at)
            VALUES (1, ?, ?, ?)
        `).run(
            settings.enabled ? 1 : 0,
            settings.intervalSeconds ?? 300,
            now
        );
    }

    return getSelfProbeSettings()!;
}

// ============================================
// Prompt Config Functions
// ============================================

import type { PromptConfig, PromptConfigRequest } from '../types/ai-provider.js';

const DEFAULT_PROMPT_CONFIGS: Omit<PromptConfig, 'createdAt' | 'updatedAt'>[] = [
    { id: 'system_prompt', name: 'System Prompt', displayName: '系統提示詞', content: null, firstOrder: 10, secondOrder: 10, enabled: true, editable: true },
    { id: 'mcp_tools', name: 'MCP Tools', displayName: 'MCP 工具說明', content: null, firstOrder: 20, secondOrder: 0, enabled: true, editable: true },
    { id: 'mcp_tools_detailed', name: 'MCP Tools Detailed', displayName: 'MCP 工具詳細列表', content: null, firstOrder: 25, secondOrder: 15, enabled: true, editable: false },
    { id: 'user_context', name: 'User Context', displayName: '用戶上下文', content: null, firstOrder: 30, secondOrder: 20, enabled: true, editable: false },
    { id: 'tool_results', name: 'Tool Results', displayName: '工具執行結果', content: null, firstOrder: 0, secondOrder: 30, enabled: true, editable: false },
    { id: 'closing', name: 'Closing', displayName: '結尾提示', content: null, firstOrder: 100, secondOrder: 100, enabled: true, editable: true }
];

function initDefaultPromptConfigs(): void {
    const db = tryGetDb();
    if (!db) return;

    const now = new Date().toISOString();
    const existingIds = (db.prepare('SELECT id FROM prompt_configs').all() as Array<{ id: string }>)
        .map(row => row.id);

    const stmt = db.prepare(`
        INSERT INTO prompt_configs (id, name, display_name, content, first_order, second_order, enabled, editable, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const config of DEFAULT_PROMPT_CONFIGS) {
        if (!existingIds.includes(config.id)) {
            stmt.run(
                config.id,
                config.name,
                config.displayName,
                config.content,
                config.firstOrder,
                config.secondOrder,
                config.enabled ? 1 : 0,
                config.editable ? 1 : 0,
                now,
                now
            );
            logger.info(`Added missing prompt config: ${config.id}`);
        }
    }
}

export function getPromptConfigs(): PromptConfig[] {
    const db = tryGetDb();
    if (!db) return [];

    const rows = db.prepare(`
        SELECT id, name, display_name as displayName, content,
               first_order as firstOrder, second_order as secondOrder,
               enabled, editable, created_at as createdAt, updated_at as updatedAt
        FROM prompt_configs
        ORDER BY first_order ASC
    `).all() as Array<{
        id: string;
        name: string;
        displayName: string;
        content: string | null;
        firstOrder: number;
        secondOrder: number;
        enabled: number;
        editable: number;
        createdAt: string;
        updatedAt: string;
    }>;

    const aiSettings = getAISettings();

    return rows.map(row => {
        let content = row.content;
        if (row.id === 'system_prompt' && !content && aiSettings.systemPrompt) {
            content = aiSettings.systemPrompt;
        } else if (row.id === 'mcp_tools' && !content && aiSettings.mcpToolsPrompt) {
            content = aiSettings.mcpToolsPrompt;
        }
        return {
            ...row,
            content,
            enabled: row.enabled === 1,
            editable: row.editable === 1
        };
    });
}

export function updatePromptConfigs(request: PromptConfigRequest): boolean {
    const db = tryGetDb();
    if (!db) return false;

    const now = new Date().toISOString();

    for (const prompt of request.prompts) {
        const updates: string[] = [];
        const values: (string | number | null)[] = [];

        if (prompt.firstOrder !== undefined) {
            updates.push('first_order = ?');
            values.push(prompt.firstOrder);
        }
        if (prompt.secondOrder !== undefined) {
            updates.push('second_order = ?');
            values.push(prompt.secondOrder);
        }
        if (prompt.enabled !== undefined) {
            updates.push('enabled = ?');
            values.push(prompt.enabled ? 1 : 0);
        }
        if (prompt.content !== undefined) {
            updates.push('content = ?');
            values.push(prompt.content);

            if (prompt.id === 'system_prompt') {
                db.prepare('UPDATE ai_settings SET system_prompt = ?, updated_at = ? WHERE id = 1')
                    .run(prompt.content || '', now);
            } else if (prompt.id === 'mcp_tools') {
                db.prepare('UPDATE ai_settings SET mcp_tools_prompt = ?, updated_at = ? WHERE id = 1')
                    .run(prompt.content || '', now);
            }
        }

        if (updates.length > 0) {
            updates.push('updated_at = ?');
            values.push(now);
            values.push(prompt.id);

            db.prepare(`UPDATE prompt_configs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        }
    }

    return true;
}

export function resetPromptConfigs(): PromptConfig[] {
    const db = tryGetDb();
    if (!db) return [];

    db.prepare('DELETE FROM prompt_configs').run();
    initDefaultPromptConfigs();
    return getPromptConfigs();
}
