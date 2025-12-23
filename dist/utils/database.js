/**
 * SQLite 資料庫管理模組
 * 使用 better-sqlite3 進行資料持久化
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { encrypt, decrypt } from './crypto-helper.js';
import { logger } from './logger.js';
const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'feedback.db');
let db = null;
/**
 * 嘗試取得已初始化的資料庫，若無法載入 native 模組（例如在無法編譯 native addon 的環境），
 * 則回傳 null，呼叫端需妥善處理回傳為 null 的情況以降級處理。
 */
function tryGetDb() {
    try {
        if (!db) {
            return initDatabase();
        }
        return db;
    }
    catch (err) {
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
export function initDatabase() {
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
    return db;
}
/**
 * 創建資料表
 */
function createTables() {
    if (!db)
        throw new Error('Database not initialized');
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
      temperature REAL,
      max_tokens INTEGER,
      auto_reply_timer_seconds INTEGER DEFAULT 300,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // 遷移：為現有的ai_settings表添加auto_reply_timer_seconds列（如果不存在）
    try {
        const columnCheck = db.prepare('PRAGMA table_info(ai_settings)').all();
        const hasColumn = columnCheck.some(col => col.name === 'auto_reply_timer_seconds');
        if (!hasColumn) {
            db.exec(`
                ALTER TABLE ai_settings 
                ADD COLUMN auto_reply_timer_seconds INTEGER DEFAULT 300
            `);
            logger.info('Successfully migrated ai_settings table - added auto_reply_timer_seconds column');
        }
    }
    catch (error) {
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // MCP Servers 索引
    db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mcp_servers_enabled ON mcp_servers(enabled)
  `);
}
/**
 * 初始化預設設定
 */
function initDefaultSettings() {
    if (!db)
        throw new Error('Database not initialized');
    // 檢查是否已有設定
    const aiSettings = db.prepare('SELECT COUNT(*) as count FROM ai_settings').get();
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
        db.prepare(`
      INSERT INTO ai_settings (api_url, model, api_key, system_prompt, temperature, max_tokens, auto_reply_timer_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('https://generativelanguage.googleapis.com/v1beta', 'gemini-2.0-flash-exp', encrypt('YOUR_API_KEY_HERE'), // 加密預設值
        defaultSystemPrompt, 0.7, 1000, 300);
    }
    // 檢查使用者偏好設定
    const preferences = db.prepare('SELECT COUNT(*) as count FROM user_preferences').get();
    if (preferences.count === 0) {
        db.prepare(`
      INSERT INTO user_preferences (auto_reply_timeout, enable_auto_reply, theme)
      VALUES (?, ?, ?)
    `).run(300, 0, 'light');
    }
}
/**
 * 關閉資料庫連接
 */
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
    }
}
/**
 * 獲取資料庫實例
 */
export function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}
// ============ 提示詞管理 ============
/**
 * 獲取所有提示詞
 */
export function getAllPrompts() {
    const db = tryGetDb();
    if (!db)
        return [];
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
        ...row,
        isPinned: Boolean(row.isPinned)
    }));
}
/**
 * 根據 ID 獲取提示詞
 */
export function getPromptById(id) {
    const db = tryGetDb();
    if (!db)
        return undefined;
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
    if (!row)
        return undefined;
    return {
        ...row,
        isPinned: Boolean(row.isPinned)
    };
}
/**
 * 創建新提示詞
 */
export function createPrompt(data) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    // 獲取當前最大的 order_index
    const maxOrder = db.prepare('SELECT MAX(order_index) as maxOrder FROM prompts').get();
    const orderIndex = (maxOrder.maxOrder ?? -1) + 1;
    const result = db.prepare(`
    INSERT INTO prompts (title, content, is_pinned, order_index, category)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.title, data.content, data.isPinned ? 1 : 0, orderIndex, data.category || null);
    const prompt = getPromptById(Number(result.lastInsertRowid));
    if (!prompt)
        throw new Error('Failed to create prompt');
    return prompt;
}
/**
 * 更新提示詞
 */
export function updatePrompt(id, data) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    // 構建動態 SQL
    const updates = [];
    const values = [];
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
    if (!prompt)
        throw new Error('Prompt not found');
    return prompt;
}
/**
 * 刪除提示詞
 */
export function deletePrompt(id) {
    const db = tryGetDb();
    if (!db)
        return false;
    const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
    return result.changes > 0;
}
/**
 * 切換提示詞釘選狀態
 */
export function togglePromptPin(id) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    const prompt = getPromptById(id);
    if (!prompt)
        throw new Error('Prompt not found');
    db.prepare(`
    UPDATE prompts
    SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(prompt.isPinned ? 0 : 1, id);
    const updated = getPromptById(id);
    if (!updated)
        throw new Error('Failed to update prompt');
    return updated;
}
/**
 * 調整提示詞順序
 */
export function reorderPrompts(prompts) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    const updateStmt = db.prepare(`
    UPDATE prompts
    SET order_index = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
    const transaction = db.transaction((items) => {
        for (const item of items) {
            updateStmt.run(item.orderIndex, item.id);
        }
    });
    transaction(prompts);
}
/**
 * 獲取釘選的提示詞（按順序）
 */
export function getPinnedPrompts() {
    const db = tryGetDb();
    if (!db)
        return [];
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
        ...row,
        isPinned: true
    }));
}
// ============ AI 設定管理 ============
/**
 * 獲取 AI 設定
 */
export function getAISettings() {
    const db = tryGetDb();
    if (!db)
        return undefined;
    const row = db.prepare(`
    SELECT 
      id, api_url as apiUrl, model, api_key as apiKey, system_prompt as systemPrompt,
      temperature, max_tokens as maxTokens, auto_reply_timer_seconds as autoReplyTimerSeconds,
      created_at as createdAt, updated_at as updatedAt
    FROM ai_settings
    ORDER BY id DESC
    LIMIT 1
  `).get();
    if (!row)
        return undefined;
    const settings = row;
    // 解密 API Key
    try {
        const encryptedKey = settings.apiKey;
        logger.debug(`[Database] 嘗試解密 API Key, 加密格式: ${encryptedKey?.substring(0, 20)}...`);
        logger.debug(`[Database] 加密密碼是否已設置: ${!!process.env['MCP_ENCRYPTION_PASSWORD']}`);
        settings.apiKey = decrypt(settings.apiKey);
        logger.debug(`[Database] API Key 解密成功, 長度: ${settings.apiKey?.length}, 前綴: ${settings.apiKey?.substring(0, 3)}...`);
    }
    catch (error) {
        logger.error('[Database] Failed to decrypt API key:', error);
        logger.error(`[Database] 使用的加密密碼: ${process.env['MCP_ENCRYPTION_PASSWORD'] ? '已設置' : '未設置(使用預設值)'}`);
        settings.apiKey = '';
    }
    return settings;
}
/**
 * 更新 AI 設定
 */
export function updateAISettings(data) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    // 檢查是否已有設定
    const existing = db.prepare('SELECT id FROM ai_settings ORDER BY id DESC LIMIT 1').get();
    if (existing) {
        // 更新現有設定
        const updates = [];
        const values = [];
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
        if (updates.length > 0) {
            updates.push('updated_at = CURRENT_TIMESTAMP');
            values.push(existing.id);
            try {
                db.prepare(`
        UPDATE ai_settings
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);
            }
            catch (err) {
                // 包裝並重新拋出具備細節的錯誤
                const error = err instanceof Error ? err : new Error(String(err));
                throw new Error(`Failed to update AI settings: ${error.message}\n${error.stack || ''}`);
            }
        }
    }
    else {
        // 創建新設定
        db.prepare(`
      INSERT INTO ai_settings (api_url, model, api_key, system_prompt, temperature, max_tokens, auto_reply_timer_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.apiUrl || 'https://generativelanguage.googleapis.com/v1beta', data.model || 'gemini-2.0-flash-exp', data.apiKey ? encrypt(data.apiKey) : encrypt('YOUR_API_KEY_HERE'), data.systemPrompt || '', data.temperature ?? 0.7, data.maxTokens ?? 1000, data.autoReplyTimerSeconds ?? 300);
    }
    const settings = getAISettings();
    if (!settings)
        throw new Error('Failed to get AI settings');
    return settings;
}
// ============ 使用者偏好設定管理 ============
/**
 * 獲取使用者偏好設定
 */
export function getUserPreferences() {
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
    const prefs = row;
    return {
        ...prefs,
        enableAutoReply: Boolean(prefs.enableAutoReply)
    };
}
/**
 * 更新使用者偏好設定
 */
export function updateUserPreferences(data) {
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
    const existing = db.prepare('SELECT id FROM user_preferences ORDER BY id DESC LIMIT 1').get();
    if (existing) {
        const updates = [];
        const values = [];
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
    }
    else {
        db.prepare(`
      INSERT INTO user_preferences (auto_reply_timeout, enable_auto_reply, theme)
      VALUES (?, ?, ?)
    `).run(data.autoReplyTimeout ?? 300, data.enableAutoReply ? 1 : 0, data.theme || 'light');
    }
    return getUserPreferences();
}
// ============ 日誌資料庫操作 ============
/**
 * 插入單筆日誌
 */
export function insertLog(log) {
    const db = tryGetDb();
    if (!db)
        return; // 無法存取資料庫時靜默失敗
    try {
        db.prepare(`
            INSERT INTO logs (level, message, context, source, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(log.level, log.message, log.context || null, log.source || null, log.createdAt || new Date().toISOString());
    }
    catch (error) {
        // 寫入日誌失敗時使用 stderr，避免遞迴
        process.stderr.write(`[Database] Failed to insert log: ${error}\n`);
    }
}
/**
 * 批次插入日誌
 */
export function insertLogs(logs) {
    const db = tryGetDb();
    if (!db || logs.length === 0)
        return;
    try {
        const insert = db.prepare(`
            INSERT INTO logs (level, message, context, source, created_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction((logs) => {
            for (const log of logs) {
                insert.run(log.level, log.message, log.context || null, log.source || null, log.createdAt || new Date().toISOString());
            }
        });
        insertMany(logs);
    }
    catch (error) {
        process.stderr.write(`[Database] Failed to insert logs batch: ${error}\n`);
    }
}
/**
 * 查詢日誌
 */
export function queryLogs(options = {}) {
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
    const conditions = [];
    const params = [];
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
    const countResult = db.prepare(countSql).get(...params);
    const total = countResult.total;
    const totalPages = Math.ceil(total / limit);
    // 查詢日誌
    const querySql = `
        SELECT id, level, message, context, source, created_at as createdAt
        FROM logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;
    const logs = db.prepare(querySql).all(...params, limit, offset);
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
export function deleteLogs(options = {}) {
    const db = tryGetDb();
    if (!db)
        return 0;
    const conditions = [];
    const params = [];
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
    }
    catch (error) {
        process.stderr.write(`[Database] Failed to delete logs: ${error}\n`);
        return 0;
    }
}
/**
 * 清理過期日誌
 * @param retentionDays 保留天數，預設 30 天
 */
export function cleanupOldLogs(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    return deleteLogs({ beforeDate: cutoffDate.toISOString() });
}
/**
 * 獲取日誌來源列表（用於篩選下拉選單）
 */
export function getLogSources() {
    const db = tryGetDb();
    if (!db)
        return [];
    try {
        const results = db.prepare(`
            SELECT DISTINCT source FROM logs WHERE source IS NOT NULL ORDER BY source
        `).all();
        return results.map(r => r.source);
    }
    catch (error) {
        return [];
    }
}
// ============ MCP Servers 管理 ============
/**
 * 獲取所有 MCP Servers
 */
export function getAllMCPServers() {
    const db = tryGetDb();
    if (!db)
        return [];
    const rows = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        ORDER BY id ASC
    `).all();
    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined
    }));
}
/**
 * 獲取已啟用的 MCP Servers
 */
export function getEnabledMCPServers() {
    const db = tryGetDb();
    if (!db)
        return [];
    const rows = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        WHERE enabled = 1
        ORDER BY id ASC
    `).all();
    return rows.map(row => ({
        ...row,
        enabled: Boolean(row.enabled),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined
    }));
}
/**
 * 根據 ID 獲取 MCP Server
 */
export function getMCPServerById(id) {
    const db = tryGetDb();
    if (!db)
        return null;
    const row = db.prepare(`
        SELECT 
            id, name, transport, command, args, env, url,
            enabled,
            created_at as createdAt,
            updated_at as updatedAt
        FROM mcp_servers
        WHERE id = ?
    `).get(id);
    if (!row)
        return null;
    return {
        ...row,
        enabled: Boolean(row.enabled),
        args: row.args ? JSON.parse(row.args) : undefined,
        env: row.env ? JSON.parse(row.env) : undefined
    };
}
/**
 * 創建 MCP Server
 */
export function createMCPServer(data) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    const result = db.prepare(`
        INSERT INTO mcp_servers (name, transport, command, args, env, url, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.name, data.transport, data.command || null, data.args ? JSON.stringify(data.args) : null, data.env ? JSON.stringify(data.env) : null, data.url || null, data.enabled !== false ? 1 : 0);
    const server = getMCPServerById(result.lastInsertRowid);
    if (!server)
        throw new Error('Failed to create MCP Server');
    logger.info(`創建 MCP Server: ${data.name} (ID: ${server.id})`);
    return server;
}
/**
 * 更新 MCP Server
 */
export function updateMCPServer(id, data) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    const existing = getMCPServerById(id);
    if (!existing)
        throw new Error(`MCP Server ${id} 不存在`);
    const updates = [];
    const params = [];
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
    if (!updated)
        throw new Error('Failed to update MCP Server');
    logger.info(`更新 MCP Server: ${updated.name} (ID: ${id})`);
    return updated;
}
/**
 * 刪除 MCP Server
 */
export function deleteMCPServer(id) {
    const db = tryGetDb();
    if (!db)
        return false;
    const existing = getMCPServerById(id);
    if (!existing)
        return false;
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
export function toggleMCPServerEnabled(id) {
    const db = tryGetDb();
    if (!db)
        throw new Error('Database unavailable');
    const existing = getMCPServerById(id);
    if (!existing)
        throw new Error(`MCP Server ${id} 不存在`);
    db.prepare(`
        UPDATE mcp_servers
        SET enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(existing.enabled ? 0 : 1, id);
    const updated = getMCPServerById(id);
    if (!updated)
        throw new Error('Failed to toggle MCP Server');
    logger.info(`切換 MCP Server 啟用狀態: ${updated.name} (ID: ${id}) -> ${updated.enabled ? '啟用' : '停用'}`);
    return updated;
}
//# sourceMappingURL=database.js.map