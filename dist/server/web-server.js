/**
 * user-feedback MCP Tools - Web伺服器實作
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MCPError } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { PortManager } from '../utils/port-manager.js';
import { ImageProcessor } from '../utils/image-processor.js';
import { ImageToTextService } from '../utils/image-to-text-service.js';
import { performanceMonitor } from '../utils/performance-monitor.js';
import { SessionStorage } from '../utils/session-storage.js';
import { projectManager } from '../utils/project-manager.js';
import { getPackageVersion } from '../utils/version.js';
const VERSION = getPackageVersion();
import { initDatabase, getAllPrompts, createPrompt, updatePrompt, deletePrompt, togglePromptPin, reorderPrompts, getPinnedPrompts, getAISettings, updateAISettings, getUserPreferences, updateUserPreferences, queryLogs, deleteLogs, getLogSources, cleanupOldLogs, getAllMCPServers, getEnabledMCPServers, getMCPServerById, createMCPServer, updateMCPServer, deleteMCPServer, toggleMCPServerEnabled, setToolEnabled, batchSetToolEnabled, queryMCPServerLogs, getRecentMCPServerErrors, cleanupOldMCPServerLogs, getCLISettings, updateCLISettings, getCLITerminals, getCLITerminalById, deleteCLITerminal, getCLIExecutionLogs, cleanupOldCLIExecutionLogs } from '../utils/database.js';
import { maskApiKey } from '../utils/crypto-helper.js';
import { generateAIReply, validateAPIKey } from '../utils/ai-service.js';
import { mcpClientManager } from '../utils/mcp-client-manager.js';
import { detectCLITools, clearDetectionCache } from '../utils/cli-detector.js';
/**
 * Web伺服器類別
 */
export class WebServer {
    app;
    server;
    io;
    config;
    port = 0;
    isServerRunning = false;
    portManager;
    imageProcessor;
    imageToTextService;
    sessionStorage;
    autoReplyTimers = new Map();
    autoReplyWarningTimers = new Map();
    constructor(config) {
        this.config = config;
        this.portManager = new PortManager();
        this.imageProcessor = new ImageProcessor({
            maxFileSize: config.maxFileSize,
            maxWidth: 2048,
            maxHeight: 2048
        });
        this.imageToTextService = new ImageToTextService(config);
        this.sessionStorage = new SessionStorage();
        // 初始化資料庫
        try {
            initDatabase();
            logger.info('資料庫初始化成功');
        }
        catch (error) {
            logger.error('資料庫初始化失敗:', error);
        }
        // 建立Express應用程式
        this.app = express();
        // 建立HTTP伺服器
        this.server = createServer(this.app);
        // 建立Socket.IO伺服器
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: config.corsOrigin,
                methods: ['GET', 'POST']
            }
        });
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.setupGracefulShutdown();
    }
    /**
     * 解析靜態資源目錄，優先使用建置產物，其次回退到原始碼目錄
     * 使用模組的實際位置而不是 process.cwd()，以支援從任何目錄啟動的 MCP 模式
     */
    getStaticAssetsPath() {
        // 取得當前模組的目錄（dist/server 或 src/server）
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // 專案根目錄的不同可能性：
        // 1. 如果從 dist/server/web-server.js 執行：__dirname = .../dist/server，向上 2 級得到專案根
        // 2. 如果從 src/server/web-server.ts 執行：__dirname = .../src/server，向上 2 級得到專案根
        const projectRoot = path.resolve(__dirname, '..', '..');
        // 嘗試在專案根目錄的相對位置查找靜態檔案
        const candidates = [
            path.resolve(projectRoot, 'dist/static'),
            path.resolve(projectRoot, 'src/static'),
            // 備選方案：使用 process.cwd() 作為最後的回退
            path.resolve(process.cwd(), 'dist/static'),
            path.resolve(process.cwd(), 'src/static')
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                logger.debug(`找到靜態資源目錄: ${candidate}`);
                return candidate;
            }
        }
        // 最後回退到專案根目錄下的 static（若存在）
        const fallback = path.resolve(projectRoot, 'static');
        logger.warn(`未找到靜態資源目錄，使用回退路徑: ${fallback}`);
        return fallback;
    }
    /**
     * 等待所有活躍會話完成或達到最大等待時間。
     * 這是簡單的輪詢實作，檢查 sessionStorage.getSessionCount() 是否降為 0。
     */
    async waitForActiveSessions(maxWaitMs) {
        const intervalMs = 1000;
        const start = Date.now();
        return new Promise((resolve, reject) => {
            const check = () => {
                try {
                    const count = this.sessionStorage.getSessionCount();
                    if (count === 0) {
                        clearInterval(timer);
                        resolve();
                        return;
                    }
                    const elapsed = Date.now() - start;
                    if (elapsed >= maxWaitMs) {
                        clearInterval(timer);
                        reject(new Error('等待活躍會話超時'));
                        return;
                    }
                    // 否則繼續等待
                }
                catch (err) {
                    clearInterval(timer);
                    reject(err);
                }
            };
            // 立即檢查一次
            check();
            const timer = setInterval(check, intervalMs);
        });
    }
    /**
     * 設定優雅結束處理
     */
    setupGracefulShutdown() {
        let isShuttingDown = false;
        // 註冊結束訊號處理
        const gracefulShutdown = async (signal) => {
            if (isShuttingDown) {
                logger.warn(`已在關閉過程中，忽略 ${signal} 訊號`);
                return;
            }
            isShuttingDown = true;
            logger.info(`收到 ${signal} 信号，嘗試優雅關閉...`);
            try {
                // 如果當前存在活躍的回饋會話，等待使用者提交或到達會話超時
                const active = this.sessionStorage.getSessionCount();
                if (active > 0) {
                    // 等待時間以 dialogTimeout 為主（毫秒），最少等待 30 秒，最多等待 5 分鐘
                    const waitMs = Math.min(Math.max(this.config.dialogTimeout * 1000, 30000), 5 * 60 * 1000);
                    logger.info(`檢測到 ${active} 個活躍會話，將等待最多 ${Math.round(waitMs / 1000)} 秒以便使用者提交回饋`);
                    try {
                        await this.waitForActiveSessions(waitMs);
                        logger.info('所有活躍會話已完成或超時，繼續關閉流程');
                    }
                    catch (waitErr) {
                        logger.warn('等待活躍會話完成時發生錯誤或超時，將繼續關閉流程', waitErr);
                    }
                }
                await this.gracefulStop();
                logger.info('優雅關閉完成');
                process.exit(0);
            }
            catch (error) {
                logger.error('優雅關閉失敗:', error);
                process.exit(1);
            }
        };
        // 標準結束訊號
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        // Windows特有的結束訊號
        if (process.platform === 'win32') {
            process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
        }
        // 未捕獲的異常
        process.on('uncaughtException', async (error) => {
            if (isShuttingDown)
                return;
            isShuttingDown = true;
            logger.error('未捕獲的異常:', error);
            try {
                await this.gracefulStop();
            }
            catch (stopError) {
                logger.error('異常結束時清理失敗:', stopError);
            }
            process.exit(1);
        });
        // 未處理的Promise拒絕 - 只記錄，不結束
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('未處理的Promise拒絕:', reason);
            logger.debug('Promise:', promise);
            // 不要因為Promise拒絕就結束程式，這在MCP環境中很常見
        });
    }
    /**
     * 設定中介軟體
     */
    setupMiddleware() {
        // 安全中介軟體
        this.app.use(helmet({
            contentSecurityPolicy: false // 允許內嵌指令碼
        }));
        // 壓縮中介軟體
        this.app.use(compression());
        // CORS中介軟體
        this.app.use(cors({
            origin: this.config.corsOrigin,
            credentials: true
        }));
        // JSON解析中介軟體
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        // 請求日誌和效能監控中介軟體
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                const success = res.statusCode < 400;
                // 記錄請求日誌
                logger.request(req.method, req.url, res.statusCode, duration);
                // 記錄效能指標
                performanceMonitor.recordRequest(duration, success);
                // 記錄慢請求
                if (duration > 1000) {
                    logger.warn(`慢請求: ${req.method} ${req.path} - ${duration}ms`);
                }
            });
            next();
        });
    }
    /**
     * 設定路由
     */
    setupRoutes() {
        const staticPath = this.getStaticAssetsPath();
        // 靜態檔案服務 - 使用絕對路徑
        this.app.use(express.static(staticPath));
        // Dashboard 路由
        this.app.get('/dashboard', (req, res) => {
            res.sendFile('dashboard.html', { root: staticPath });
        });
        // MCP 設定頁面路由
        this.app.get('/mcp-settings', (req, res) => {
            res.sendFile('mcp-settings.html', { root: staticPath });
        });
        // 日誌頁面路由
        this.app.get('/logs', (req, res) => {
            res.sendFile('logs.html', { root: staticPath });
        });
        // CLI 終端機頁面路由
        this.app.get('/terminals', (req, res) => {
            res.sendFile('terminals.html', { root: staticPath });
        });
        // 設定頁面路由
        this.app.get('/settings', (req, res) => {
            res.sendFile('settings.html', { root: staticPath });
        });
        // 主页路由 - Session 頁面
        this.app.get('/', (req, res) => {
            res.sendFile('index.html', { root: staticPath });
        });
        // API設定路由
        this.app.get('/api/config', (req, res) => {
            const chatConfig = {
                api_key: this.config.apiKey || '',
                api_base_url: this.config.apiBaseUrl || 'https://api.openai.com/v1',
                model: this.config.defaultModel || 'gpt-4o-mini',
                enable_chat: this.config.enableChat !== false, // 預設啟用
                max_file_size: this.config.maxFileSize,
                dialog_timeout: this.config.dialogTimeout, // MCP_DIALOG_TIMEOUT (毫秒)
                temperature: 0.7,
                max_tokens: 2000
            };
            logger.info('回傳聊天設定:', {
                hasApiKey: !!chatConfig.api_key,
                apiBaseUrl: chatConfig.api_base_url,
                model: chatConfig.model,
                enableChat: chatConfig.enable_chat,
                dialogTimeout: chatConfig.dialog_timeout
            });
            res.json(chatConfig);
        });
        // 測試會話建立路由
        this.app.post('/api/test-session', (req, res) => {
            const { work_summary, timeout_seconds = 300, project_name, project_path } = req.body;
            if (!work_summary) {
                res.status(400).json({ error: '缺少work_summary參數' });
                return;
            }
            const sessionId = this.generateSessionId();
            // 處理專案
            const project = project_name
                ? projectManager.getOrCreateProject(project_name, project_path)
                : projectManager.getDefaultProject();
            // 建立測試會話
            const session = {
                workSummary: work_summary,
                feedback: [],
                startTime: Date.now(),
                timeout: timeout_seconds * 1000,
                projectId: project.id,
                projectName: project.name
            };
            this.sessionStorage.createSession(sessionId, session);
            // 更新專案最後活動時間
            projectManager.updateLastActive(project.id);
            // 記錄會話建立
            performanceMonitor.recordSessionCreated();
            // 發送 Dashboard 會話建立事件
            this.emitDashboardSessionCreated(project.id, sessionId, project.name, work_summary);
            logger.info(`建立測試會話: ${sessionId}`);
            res.json({
                success: true,
                session_id: sessionId,
                feedback_url: this.generateFeedbackUrl(sessionId),
                project_id: project.id,
                project_name: project.name
            });
        });
        // 版本資訊API
        this.app.get('/api/version', (req, res) => {
            res.json({
                version: VERSION,
                timestamp: new Date().toISOString()
            });
        });
        // 健康檢查路由
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: VERSION,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                active_sessions: this.sessionStorage.getSessionCount()
            });
        });
        // ============ Dashboard API ============
        // 獲取 Dashboard 概覽
        this.app.get('/api/dashboard/overview', (req, res) => {
            try {
                const projects = projectManager.getAllProjects();
                const projectInfos = projects.map(project => {
                    const projectSessions = this.sessionStorage.getSessionsByProject(project.id);
                    const sessions = [];
                    let activeSessions = 0;
                    projectSessions.forEach((sessionData, sessionId) => {
                        const isActive = Date.now() - sessionData.startTime < sessionData.timeout;
                        if (isActive)
                            activeSessions++;
                        sessions.push({
                            sessionId,
                            status: isActive ? 'active' : 'timeout',
                            workSummary: sessionData.workSummary || '',
                            createdAt: new Date(sessionData.startTime).toISOString(),
                            lastActivityAt: new Date(sessionData.startTime).toISOString()
                        });
                    });
                    return {
                        project,
                        sessions,
                        totalSessions: sessions.length,
                        activeSessions
                    };
                });
                const totalActiveSessions = projectInfos.reduce((sum, p) => sum + p.activeSessions, 0);
                res.json({
                    projects: projectInfos,
                    totalProjects: projects.length,
                    totalActiveSessions
                });
            }
            catch (error) {
                logger.error('獲取 Dashboard 概覽失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取 Dashboard 概覽失敗'
                });
            }
        });
        // 獲取特定專案詳情
        this.app.get('/api/dashboard/projects/:projectId', (req, res) => {
            try {
                const { projectId } = req.params;
                const project = projectManager.getProject(projectId);
                if (!project) {
                    res.status(404).json({ success: false, error: '專案不存在' });
                    return;
                }
                const projectSessions = this.sessionStorage.getSessionsByProject(projectId);
                const sessions = [];
                let activeSessions = 0;
                projectSessions.forEach((sessionData, sessionId) => {
                    const isActive = Date.now() - sessionData.startTime < sessionData.timeout;
                    if (isActive)
                        activeSessions++;
                    sessions.push({
                        sessionId,
                        status: isActive ? 'active' : 'timeout',
                        workSummary: sessionData.workSummary || '',
                        createdAt: new Date(sessionData.startTime).toISOString(),
                        lastActivityAt: new Date(sessionData.startTime).toISOString()
                    });
                });
                res.json({
                    success: true,
                    project,
                    sessions,
                    totalSessions: sessions.length,
                    activeSessions
                });
            }
            catch (error) {
                logger.error('獲取專案詳情失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取專案詳情失敗'
                });
            }
        });
        // 獲取 Session 詳情（用於 Dashboard 導航）
        this.app.get('/api/dashboard/sessions/:sessionId', (req, res) => {
            try {
                const { sessionId } = req.params;
                const session = this.sessionStorage.getSession(sessionId);
                if (!session) {
                    res.status(404).json({ success: false, error: 'Session 不存在' });
                    return;
                }
                res.json({
                    success: true,
                    session: {
                        id: sessionId,
                        workSummary: session.workSummary,
                        status: Date.now() - session.startTime < session.timeout ? 'active' : 'timeout',
                        projectId: session.projectId,
                        projectName: session.projectName,
                        createdAt: new Date(session.startTime).toISOString()
                    }
                });
            }
            catch (error) {
                logger.error('獲取 Session 詳情失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取 Session 詳情失敗'
                });
            }
        });
        // 效能監控路由
        this.app.get('/api/metrics', (req, res) => {
            const metrics = performanceMonitor.getMetrics();
            res.json(metrics);
        });
        // 效能報告路由
        this.app.get('/api/performance-report', (req, res) => {
            const report = performanceMonitor.getFormattedReport();
            res.type('text/plain').send(report);
        });
        // 圖片轉文字API
        this.app.post('/api/convert-images', async (req, res) => {
            try {
                const { images } = req.body;
                if (!images || !Array.isArray(images) || images.length === 0) {
                    res.status(400).json({
                        success: false,
                        error: '請提供要轉換的圖片資料'
                    });
                    return;
                }
                // 檢查功能是否啟用
                if (!this.imageToTextService.isEnabled()) {
                    res.status(400).json({
                        success: false,
                        error: '圖片轉文字功能未啟用或API金鑰未設定'
                    });
                    return;
                }
                logger.info(`開始轉換 ${images.length} 張圖片為文字`);
                // 批量轉換圖片
                const descriptions = await this.imageToTextService.convertMultipleImages(images);
                logger.info(`圖片轉文字完成，共轉換 ${descriptions.length} 張圖片`);
                res.json({
                    success: true,
                    descriptions
                });
            }
            catch (error) {
                logger.error('圖片轉文字API錯誤:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '圖片轉文字處理失敗'
                });
            }
        });
        // ============ 提示詞管理 API ============
        // 獲取所有提示詞
        this.app.get('/api/prompts', (req, res) => {
            try {
                const prompts = getAllPrompts();
                res.json({ success: true, prompts });
            }
            catch (error) {
                logger.error('獲取提示詞失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取提示詞失敗'
                });
            }
        });
        // 獲取釘選的提示詞
        this.app.get('/api/prompts/pinned', (req, res) => {
            try {
                const prompts = getPinnedPrompts();
                res.json({ success: true, prompts });
            }
            catch (error) {
                logger.error('獲取釘選提示詞失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取釘選提示詞失敗'
                });
            }
        });
        // 創建提示詞
        this.app.post('/api/prompts', (req, res) => {
            try {
                const data = req.body;
                if (!data.title || !data.content) {
                    res.status(400).json({
                        success: false,
                        error: '標題和內容為必填欄位'
                    });
                    return;
                }
                const prompt = createPrompt(data);
                logger.info(`創建提示詞成功: ${prompt.id}`);
                res.json({ success: true, prompt });
            }
            catch (error) {
                logger.error('創建提示詞失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '創建提示詞失敗'
                });
            }
        });
        // 更新提示詞
        this.app.put('/api/prompts/:id', (req, res) => {
            try {
                const id = parseInt(req.params.id);
                const data = req.body;
                if (isNaN(id)) {
                    res.status(400).json({
                        success: false,
                        error: '無效的提示詞 ID'
                    });
                    return;
                }
                const prompt = updatePrompt(id, data);
                logger.info(`更新提示詞成功: ${id}`);
                res.json({ success: true, prompt });
            }
            catch (error) {
                logger.error('更新提示詞失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '更新提示詞失敗'
                });
            }
        });
        // 刪除提示詞
        this.app.delete('/api/prompts/:id', (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({
                        success: false,
                        error: '無效的提示詞 ID'
                    });
                    return;
                }
                const deleted = deletePrompt(id);
                if (deleted) {
                    logger.info(`刪除提示詞成功: ${id}`);
                    res.json({ success: true });
                }
                else {
                    res.status(404).json({
                        success: false,
                        error: '提示詞不存在'
                    });
                }
            }
            catch (error) {
                logger.error('刪除提示詞失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '刪除提示詞失敗'
                });
            }
        });
        // 切換釘選狀態
        this.app.put('/api/prompts/:id/pin', (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({
                        success: false,
                        error: '無效的提示詞 ID'
                    });
                    return;
                }
                const prompt = togglePromptPin(id);
                logger.info(`切換提示詞釘選狀態: ${id}, 釘選=${prompt.isPinned}`);
                res.json({ success: true, prompt });
            }
            catch (error) {
                logger.error('切換釘選狀態失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '切換釘選狀態失敗'
                });
            }
        });
        // 調整提示詞順序
        this.app.put('/api/prompts/reorder', (req, res) => {
            try {
                const data = req.body;
                if (!data.prompts || !Array.isArray(data.prompts)) {
                    res.status(400).json({
                        success: false,
                        error: '無效的排序資料'
                    });
                    return;
                }
                reorderPrompts(data.prompts);
                logger.info(`調整提示詞順序成功，共 ${data.prompts.length} 個`);
                res.json({ success: true });
            }
            catch (error) {
                logger.error('調整提示詞順序失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '調整提示詞順序失敗'
                });
            }
        });
        // ============ AI 設定 API ============
        // 獲取 AI 設定
        this.app.get('/api/ai-settings', (req, res) => {
            try {
                const settings = getAISettings();
                if (!settings) {
                    res.json({
                        success: false,
                        error: 'AI 設定不存在'
                    });
                    return;
                }
                // 遮罩 API Key
                const response = {
                    success: true,
                    settings: {
                        id: settings.id,
                        apiUrl: settings.apiUrl,
                        model: settings.model,
                        apiKeyMasked: maskApiKey(settings.apiKey),
                        systemPrompt: settings.systemPrompt,
                        mcpToolsPrompt: settings.mcpToolsPrompt,
                        temperature: settings.temperature,
                        maxTokens: settings.maxTokens,
                        autoReplyTimerSeconds: settings.autoReplyTimerSeconds,
                        maxToolRounds: settings.maxToolRounds ?? 5,
                        debugMode: settings.debugMode ?? false,
                        createdAt: settings.createdAt,
                        updatedAt: settings.updatedAt
                    }
                };
                res.json(response);
            }
            catch (error) {
                logger.error('獲取 AI 設定失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取 AI 設定失敗'
                });
            }
        });
        // 更新 AI 設定
        this.app.put('/api/ai-settings', (req, res) => {
            try {
                const data = req.body;
                const settings = updateAISettings(data);
                logger.info('更新 AI 設定成功');
                // 遮罩 API Key
                const response = {
                    success: true,
                    settings: {
                        id: settings.id,
                        apiUrl: settings.apiUrl,
                        model: settings.model,
                        apiKeyMasked: maskApiKey(settings.apiKey),
                        systemPrompt: settings.systemPrompt,
                        mcpToolsPrompt: settings.mcpToolsPrompt,
                        temperature: settings.temperature,
                        maxTokens: settings.maxTokens,
                        autoReplyTimerSeconds: settings.autoReplyTimerSeconds,
                        maxToolRounds: settings.maxToolRounds ?? 5,
                        debugMode: settings.debugMode ?? false,
                        createdAt: settings.createdAt,
                        updatedAt: settings.updatedAt
                    }
                };
                res.json(response);
            }
            catch (error) {
                logger.error('更新 AI 設定失敗:', error);
                // 包含詳細錯誤資訊，供前端顯示（注意：在公開環境請審慎處理 stack 資訊）
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '更新 AI 設定失敗',
                    details: error instanceof Error ? error.details || null : null,
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        });
        // 驗證 API Key
        this.app.post('/api/ai-settings/validate', async (req, res) => {
            try {
                let { apiKey } = req.body;
                const { model } = req.body;
                if (!model) {
                    res.status(400).json({
                        success: false,
                        error: '模型為必填欄位'
                    });
                    return;
                }
                let usingDatabaseKey = false;
                // 如果沒有提供 API Key，則從資料庫獲取並解密
                if (!apiKey) {
                    const settings = getAISettings();
                    if (!settings || !settings.apiKey || settings.apiKey === 'YOUR_API_KEY_HERE') {
                        res.status(400).json({
                            success: false,
                            valid: false,
                            error: '請先設定 API Key'
                        });
                        return;
                    }
                    // getAISettings() 已經自動解密了 API Key
                    apiKey = settings.apiKey;
                    usingDatabaseKey = true;
                    logger.info('使用資料庫中解密的 API Key 進行驗證');
                    logger.debug(`解密後的 API Key 長度: ${apiKey.length}, 前綴: ${apiKey.substring(0, 3)}...`);
                }
                else {
                    logger.info('使用新輸入的 API Key 進行驗證');
                    logger.debug(`新輸入的 API Key 長度: ${apiKey.length}, 前綴: ${apiKey.substring(0, 3)}...`);
                }
                const result = await validateAPIKey(apiKey, model);
                if (result.valid) {
                    logger.info(`API Key 驗證成功 (${usingDatabaseKey ? '資料庫' : '新輸入'})`);
                    res.json({ success: true, valid: true });
                }
                else {
                    logger.warn(`API Key 驗證失敗 (${usingDatabaseKey ? '資料庫' : '新輸入'}):`, result.error);
                    res.json({ success: false, valid: false, error: result.error });
                }
            }
            catch (error) {
                logger.error('驗證 API Key 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '驗證失敗'
                });
            }
        });
        // ============ AI 回覆生成 API ============
        // 生成 AI 回覆
        this.app.post('/api/ai-reply', async (req, res) => {
            try {
                const data = req.body;
                if (!data.aiMessage) {
                    res.status(400).json({
                        success: false,
                        error: 'AI 訊息為必填欄位'
                    });
                    return;
                }
                logger.info('開始生成 AI 回覆');
                const result = await generateAIReply(data);
                if (result.success) {
                    logger.info('AI 回覆生成成功');
                }
                else {
                    logger.warn('AI 回覆生成失敗:', result.error);
                }
                res.json(result);
            }
            catch (error) {
                logger.error('生成 AI 回覆失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '生成 AI 回覆失敗'
                });
            }
        });
        // 獲取提示詞預覽（不執行 AI）
        this.app.post('/api/prompt-preview', async (req, res) => {
            try {
                const data = req.body;
                if (!data.aiMessage) {
                    res.status(400).json({
                        success: false,
                        error: 'AI 訊息為必填欄位'
                    });
                    return;
                }
                const { getPromptPreview } = await import('../utils/ai-service.js');
                const result = await getPromptPreview(data);
                res.json(result);
            }
            catch (error) {
                logger.error('獲取提示詞預覽失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取提示詞預覽失敗'
                });
            }
        });
        // ============ 使用者偏好設定 API ============
        // 獲取使用者偏好設定
        this.app.get('/api/preferences', (req, res) => {
            try {
                const preferences = getUserPreferences();
                res.json({ success: true, preferences });
            }
            catch (error) {
                logger.error('獲取使用者偏好設定失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取使用者偏好設定失敗'
                });
            }
        });
        // 更新使用者偏好設定
        this.app.put('/api/preferences', (req, res) => {
            try {
                const data = req.body;
                const preferences = updateUserPreferences(data);
                logger.info('更新使用者偏好設定成功');
                res.json({ success: true, preferences });
            }
            catch (error) {
                logger.error('更新使用者偏好設定失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '更新使用者偏好設定失敗',
                    details: error instanceof Error ? error.details || null : null,
                    stack: error instanceof Error ? error.stack : undefined
                });
            }
        });
        // ============ 日誌 API ============
        // 查詢日誌
        this.app.get('/api/logs', (req, res) => {
            try {
                const options = {};
                if (req.query['page'])
                    options.page = parseInt(req.query['page']);
                if (req.query['limit'])
                    options.limit = parseInt(req.query['limit']);
                if (req.query['level'])
                    options.level = req.query['level'];
                if (req.query['search'])
                    options.search = req.query['search'];
                if (req.query['source'])
                    options.source = req.query['source'];
                if (req.query['startDate'])
                    options.startDate = req.query['startDate'];
                if (req.query['endDate'])
                    options.endDate = req.query['endDate'];
                const result = queryLogs(options);
                res.json({ success: true, ...result });
            }
            catch (error) {
                logger.error('查詢日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '查詢日誌失敗'
                });
            }
        });
        // 獲取日誌來源列表
        this.app.get('/api/logs/sources', (req, res) => {
            try {
                const sources = getLogSources();
                res.json({ success: true, sources });
            }
            catch (error) {
                logger.error('獲取日誌來源列表失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取日誌來源列表失敗'
                });
            }
        });
        // 刪除日誌
        this.app.delete('/api/logs', (req, res) => {
            try {
                const options = {};
                if (req.query['beforeDate'])
                    options.beforeDate = req.query['beforeDate'];
                if (req.query['level'])
                    options.level = req.query['level'];
                const deletedCount = deleteLogs(options);
                logger.info(`刪除日誌成功，共刪除 ${deletedCount} 筆`);
                res.json({ success: true, deletedCount });
            }
            catch (error) {
                logger.error('刪除日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '刪除日誌失敗'
                });
            }
        });
        // 清理過期日誌
        this.app.post('/api/logs/cleanup', (req, res) => {
            try {
                const retentionDays = req.body.retentionDays || 30;
                const deletedCount = cleanupOldLogs(retentionDays);
                logger.info(`清理過期日誌成功，共刪除 ${deletedCount} 筆`);
                res.json({ success: true, deletedCount });
            }
            catch (error) {
                logger.error('清理過期日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '清理過期日誌失敗'
                });
            }
        });
        // ============ MCP Servers API ============
        // 獲取所有 MCP Servers
        this.app.get('/api/mcp-servers', (req, res) => {
            try {
                const servers = getAllMCPServers();
                const states = mcpClientManager.getAllStates();
                const serversWithState = servers.map(server => ({
                    ...server,
                    state: states.find(s => s.id === server.id) || {
                        id: server.id,
                        status: 'disconnected',
                        tools: [],
                        resources: [],
                        prompts: []
                    }
                }));
                res.json({ success: true, servers: serversWithState });
            }
            catch (error) {
                logger.error('獲取 MCP Servers 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取 MCP Servers 失敗'
                });
            }
        });
        // 獲取單一 MCP Server
        this.app.get('/api/mcp-servers/:id', (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                const server = getMCPServerById(id);
                if (!server) {
                    res.status(404).json({ success: false, error: 'MCP Server 不存在' });
                    return;
                }
                const state = mcpClientManager.getState(id);
                res.json({
                    success: true,
                    server: {
                        ...server,
                        state: state || {
                            id: server.id,
                            status: 'disconnected',
                            tools: [],
                            resources: [],
                            prompts: []
                        }
                    }
                });
            }
            catch (error) {
                logger.error('獲取 MCP Server 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取 MCP Server 失敗'
                });
            }
        });
        // 創建 MCP Server
        this.app.post('/api/mcp-servers', (req, res) => {
            try {
                const data = req.body;
                if (!data.name || !data.transport) {
                    res.status(400).json({
                        success: false,
                        error: '名稱和傳輸方式為必填欄位'
                    });
                    return;
                }
                if (data.transport === 'stdio' && !data.command) {
                    res.status(400).json({
                        success: false,
                        error: 'stdio 傳輸方式需要指定 command'
                    });
                    return;
                }
                if ((data.transport === 'sse' || data.transport === 'streamable-http') && !data.url) {
                    res.status(400).json({
                        success: false,
                        error: `${data.transport} 傳輸方式需要指定 url`
                    });
                    return;
                }
                const server = createMCPServer(data);
                logger.info(`創建 MCP Server 成功: ${server.name} (ID: ${server.id})`);
                res.json({ success: true, server });
            }
            catch (error) {
                logger.error('創建 MCP Server 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '創建 MCP Server 失敗'
                });
            }
        });
        // 更新 MCP Server
        this.app.put('/api/mcp-servers/:id', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                const data = req.body;
                const server = updateMCPServer(id, data);
                if (mcpClientManager.isConnected(id)) {
                    await mcpClientManager.disconnect(id);
                    if (server.enabled) {
                        await mcpClientManager.connect(server);
                    }
                }
                const state = mcpClientManager.getState(id);
                logger.info(`更新 MCP Server 成功: ${server.name} (ID: ${id})`);
                res.json({
                    success: true,
                    server: {
                        ...server,
                        state: state || { id, status: 'disconnected', tools: [], resources: [], prompts: [] }
                    }
                });
            }
            catch (error) {
                logger.error('更新 MCP Server 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '更新 MCP Server 失敗'
                });
            }
        });
        // 刪除 MCP Server
        this.app.delete('/api/mcp-servers/:id', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                await mcpClientManager.disconnect(id);
                const deleted = deleteMCPServer(id);
                if (deleted) {
                    logger.info(`刪除 MCP Server 成功: ID ${id}`);
                    res.json({ success: true });
                }
                else {
                    res.status(404).json({ success: false, error: 'MCP Server 不存在' });
                }
            }
            catch (error) {
                logger.error('刪除 MCP Server 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '刪除 MCP Server 失敗'
                });
            }
        });
        // 切換 MCP Server 啟用狀態
        this.app.put('/api/mcp-servers/:id/toggle', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                const server = toggleMCPServerEnabled(id);
                if (server.enabled) {
                    await mcpClientManager.connect(server);
                }
                else {
                    await mcpClientManager.disconnect(id);
                }
                const state = mcpClientManager.getState(id);
                logger.info(`切換 MCP Server 啟用狀態: ${server.name} -> ${server.enabled ? '啟用' : '停用'}`);
                res.json({
                    success: true,
                    server: {
                        ...server,
                        state: state || { id, status: 'disconnected', tools: [], resources: [], prompts: [] }
                    }
                });
            }
            catch (error) {
                logger.error('切換 MCP Server 啟用狀態失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '切換 MCP Server 啟用狀態失敗'
                });
            }
        });
        // 連接 MCP Server
        this.app.post('/api/mcp-servers/:id/connect', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                const server = getMCPServerById(id);
                if (!server) {
                    res.status(404).json({ success: false, error: 'MCP Server 不存在' });
                    return;
                }
                const state = await mcpClientManager.connect(server);
                logger.info(`連接 MCP Server: ${server.name} -> ${state.status}`);
                res.json({ success: state.status === 'connected', state });
            }
            catch (error) {
                logger.error('連接 MCP Server 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '連接 MCP Server 失敗'
                });
            }
        });
        // 斷開 MCP Server
        this.app.post('/api/mcp-servers/:id/disconnect', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                await mcpClientManager.disconnect(id);
                logger.info(`斷開 MCP Server: ID ${id}`);
                res.json({ success: true });
            }
            catch (error) {
                logger.error('斷開 MCP Server 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '斷開 MCP Server 失敗'
                });
            }
        });
        // 獲取 MCP Server 工具列表
        this.app.get('/api/mcp-servers/:id/tools', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                const state = mcpClientManager.getState(id);
                if (!state || state.status !== 'connected') {
                    res.status(400).json({ success: false, error: 'MCP Server 未連接' });
                    return;
                }
                const tools = await mcpClientManager.refreshTools(id);
                res.json({ success: true, tools });
            }
            catch (error) {
                logger.error('獲取 MCP Server 工具列表失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取工具列表失敗'
                });
            }
        });
        // 獲取所有已連接 MCP Servers 的工具
        this.app.get('/api/mcp-tools', (req, res) => {
            try {
                const tools = mcpClientManager.getAllTools();
                res.json({ success: true, tools });
            }
            catch (error) {
                logger.error('獲取 MCP 工具列表失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取工具列表失敗'
                });
            }
        });
        // ============ MCP 工具執行 API (AI Integration) ============
        // 執行單一 MCP 工具 (by tool name, auto-find server)
        this.app.post('/api/mcp/execute-tool', async (req, res) => {
            try {
                const { name, arguments: args } = req.body;
                if (!name) {
                    res.status(400).json({ success: false, error: '缺少工具名稱' });
                    return;
                }
                const allTools = mcpClientManager.getAllTools();
                const toolInfo = allTools.find(t => t.name === name);
                if (!toolInfo || toolInfo.serverId === undefined) {
                    res.status(404).json({ success: false, error: `工具 ${name} 不存在或未連接` });
                    return;
                }
                const result = await mcpClientManager.callTool(toolInfo.serverId, name, args || {});
                if (result.success) {
                    logger.info(`MCP 工具執行成功: ${name}`);
                }
                else {
                    logger.warn(`MCP 工具執行失敗: ${name} - ${result.error}`);
                }
                res.json(result);
            }
            catch (error) {
                logger.error('MCP 工具執行失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '工具執行失敗'
                });
            }
        });
        // 批次執行多個 MCP 工具
        this.app.post('/api/mcp/execute-tools', async (req, res) => {
            try {
                const { tools } = req.body;
                if (!Array.isArray(tools) || tools.length === 0) {
                    res.status(400).json({ success: false, error: '缺少工具列表' });
                    return;
                }
                const allMcpTools = mcpClientManager.getAllTools();
                const results = [];
                for (const tool of tools) {
                    const { name, arguments: args } = tool;
                    if (!name) {
                        results.push({ name: 'unknown', success: false, error: '缺少工具名稱' });
                        continue;
                    }
                    const toolInfo = allMcpTools.find(t => t.name === name);
                    if (!toolInfo || toolInfo.serverId === undefined) {
                        results.push({ name, success: false, error: `工具 ${name} 不存在或未連接` });
                        continue;
                    }
                    try {
                        const result = await mcpClientManager.callTool(toolInfo.serverId, name, args || {});
                        const entry = {
                            name,
                            success: result.success,
                            result: result.content
                        };
                        if (result.error) {
                            entry.error = result.error;
                        }
                        results.push(entry);
                    }
                    catch (err) {
                        results.push({
                            name,
                            success: false,
                            error: err instanceof Error ? err.message : '執行失敗'
                        });
                    }
                }
                logger.info(`批次執行 MCP 工具完成: ${results.filter(r => r.success).length}/${results.length} 成功`);
                res.json({ success: true, results });
            }
            catch (error) {
                logger.error('批次執行 MCP 工具失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '批次執行失敗'
                });
            }
        });
        // 呼叫 MCP 工具
        this.app.post('/api/mcp-servers/:id/tools/:toolName/call', async (req, res) => {
            try {
                const id = parseInt(req.params.id);
                const toolName = req.params.toolName;
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                const args = req.body.arguments || {};
                const result = await mcpClientManager.callTool(id, toolName, args);
                if (result.success) {
                    logger.info(`MCP 工具呼叫成功: ${toolName}`);
                }
                else {
                    logger.warn(`MCP 工具呼叫失敗: ${toolName} - ${result.error}`);
                }
                res.json(result);
            }
            catch (error) {
                logger.error('MCP 工具呼叫失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '工具呼叫失敗'
                });
            }
        });
        // ============ MCP Tool 啟用管理 API ============
        // 獲取 Server 的工具列表（包含啟用狀態）
        this.app.get('/api/mcp-servers/:id/tools/config', (req, res) => {
            try {
                const id = parseInt(req.params.id);
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                const tools = mcpClientManager.getServerTools(id, true);
                res.json({ success: true, tools });
            }
            catch (error) {
                logger.error('獲取工具配置失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取工具配置失敗'
                });
            }
        });
        // 設定單一工具啟用狀態
        this.app.put('/api/mcp-servers/:id/tools/:toolName/enable', (req, res) => {
            try {
                const id = parseInt(req.params.id);
                const toolName = decodeURIComponent(req.params.toolName);
                const { enabled } = req.body;
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                if (typeof enabled !== 'boolean') {
                    res.status(400).json({ success: false, error: 'enabled 參數必須是布林值' });
                    return;
                }
                setToolEnabled(id, toolName, enabled);
                logger.info(`設定工具啟用狀態: Server ${id}, ${toolName} -> ${enabled ? '啟用' : '停用'}`);
                res.json({ success: true });
            }
            catch (error) {
                logger.error('設定工具啟用狀態失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '設定工具啟用狀態失敗'
                });
            }
        });
        // 批次設定工具啟用狀態
        this.app.put('/api/mcp-servers/:id/tools/batch-enable', (req, res) => {
            try {
                const id = parseInt(req.params.id);
                const { tools } = req.body;
                if (isNaN(id)) {
                    res.status(400).json({ success: false, error: '無效的 Server ID' });
                    return;
                }
                if (!Array.isArray(tools)) {
                    res.status(400).json({ success: false, error: 'tools 必須是陣列' });
                    return;
                }
                batchSetToolEnabled(id, tools.map(t => ({
                    toolName: t.toolName,
                    enabled: t.enabled
                })));
                logger.info(`批次設定工具啟用狀態: Server ${id}, 共 ${tools.length} 個工具`);
                res.json({ success: true });
            }
            catch (error) {
                logger.error('批次設定工具啟用狀態失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '批次設定工具啟用狀態失敗'
                });
            }
        });
        // ============ Serena MCP 預設配置 API ============
        // 獲取 Serena 預設配置
        this.app.get('/api/mcp-presets/serena', (req, res) => {
            try {
                const projectPath = req.query['projectPath'] || '';
                const preset = {
                    name: 'Serena',
                    transport: 'stdio',
                    command: 'uvx',
                    args: [
                        '--from',
                        'git+https://github.com/oraios/serena',
                        'serena',
                        'start-mcp-server',
                        ...(projectPath ? ['--project', projectPath] : ['--project-from-cwd'])
                    ],
                    env: {},
                    description: 'Serena MCP Server - 智慧程式碼分析工具'
                };
                res.json({ success: true, preset });
            }
            catch (error) {
                logger.error('獲取 Serena 預設配置失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取預設配置失敗'
                });
            }
        });
        // 使用 Serena 預設配置創建 MCP Server
        this.app.post('/api/mcp-presets/serena/create', async (req, res) => {
            try {
                const { projectPath, autoConnect = true } = req.body;
                const serverData = {
                    name: 'Serena',
                    transport: 'stdio',
                    command: 'uvx',
                    args: [
                        '--from',
                        'git+https://github.com/oraios/serena',
                        'serena',
                        'start-mcp-server',
                        ...(projectPath ? ['--project', projectPath] : ['--project-from-cwd'])
                    ],
                    env: {},
                    enabled: true
                };
                const server = createMCPServer(serverData);
                logger.info(`創建 Serena MCP Server: ID ${server.id}`);
                let state = null;
                if (autoConnect) {
                    state = await mcpClientManager.connect(server);
                    if (state.status === 'connected') {
                        logger.info(`Serena MCP Server 連接成功: ID ${server.id}, 工具數量: ${state.tools.length}`);
                    }
                    else {
                        logger.error(`Serena MCP Server 連接失敗: ID ${server.id}, 錯誤: ${state.error}`);
                    }
                }
                res.json({
                    success: true,
                    server: {
                        ...server,
                        state: state || { id: server.id, status: 'disconnected', tools: [], resources: [], prompts: [] }
                    }
                });
            }
            catch (error) {
                logger.error('創建 Serena MCP Server 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '創建 Serena MCP Server 失敗'
                });
            }
        });
        // 自動連接已啟用的 MCP Servers
        this.app.post('/api/mcp-servers/connect-all', async (req, res) => {
            try {
                const enabledServers = getEnabledMCPServers();
                const results = [];
                for (const server of enabledServers) {
                    const state = await mcpClientManager.connect(server);
                    results.push({
                        id: server.id,
                        name: server.name,
                        success: state.status === 'connected',
                        error: state.error
                    });
                }
                logger.info(`自動連接 MCP Servers 完成: ${results.filter(r => r.success).length}/${results.length} 成功`);
                res.json({ success: true, results });
            }
            catch (error) {
                logger.error('自動連接 MCP Servers 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '自動連接失敗'
                });
            }
        });
        // 斷開所有 MCP Servers
        this.app.post('/api/mcp-servers/disconnect-all', async (req, res) => {
            try {
                await mcpClientManager.disconnectAll();
                logger.info('已斷開所有 MCP Servers');
                res.json({ success: true });
            }
            catch (error) {
                logger.error('斷開所有 MCP Servers 失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '斷開失敗'
                });
            }
        });
        // ============ MCP Server 日誌 API ============
        // 查詢 MCP Server 日誌
        this.app.get('/api/mcp-servers/logs', (req, res) => {
            try {
                const serverIdParam = req.query['serverId'];
                const type = req.query['type'];
                const limit = req.query['limit'] ? parseInt(req.query['limit']) : 100;
                const offset = req.query['offset'] ? parseInt(req.query['offset']) : 0;
                const options = { limit, offset };
                if (serverIdParam) {
                    options.serverId = parseInt(serverIdParam);
                }
                if (type) {
                    options.type = type;
                }
                const result = queryMCPServerLogs(options);
                res.json({ success: true, ...result });
            }
            catch (error) {
                logger.error('查詢 MCP Server 日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '查詢日誌失敗'
                });
            }
        });
        // 獲取特定 Server 的日誌
        this.app.get('/api/mcp-servers/:id/logs', (req, res) => {
            try {
                const serverId = parseInt(req.params.id);
                const type = req.query['type'];
                const limit = req.query['limit'] ? parseInt(req.query['limit']) : 100;
                const offset = req.query['offset'] ? parseInt(req.query['offset']) : 0;
                const result = queryMCPServerLogs({
                    serverId,
                    type: type,
                    limit,
                    offset
                });
                res.json({ success: true, ...result });
            }
            catch (error) {
                logger.error(`獲取 MCP Server ${req.params.id} 日誌失敗:`, error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取日誌失敗'
                });
            }
        });
        // 獲取最近的錯誤日誌
        this.app.get('/api/mcp-servers/errors', (req, res) => {
            try {
                const serverId = req.query['serverId'] ? parseInt(req.query['serverId']) : undefined;
                const limit = req.query['limit'] ? parseInt(req.query['limit']) : 50;
                const errors = getRecentMCPServerErrors(serverId, limit);
                res.json({ success: true, errors });
            }
            catch (error) {
                logger.error('獲取 MCP Server 錯誤日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取錯誤日誌失敗'
                });
            }
        });
        // 清理舊的 MCP Server 日誌
        this.app.delete('/api/mcp-servers/logs/cleanup', (req, res) => {
            try {
                const daysToKeep = req.query['daysToKeep'] ? parseInt(req.query['daysToKeep']) : 7;
                const deletedCount = cleanupOldMCPServerLogs(daysToKeep);
                logger.info(`清理 MCP Server 日誌: 刪除了 ${deletedCount} 筆記錄`);
                res.json({ success: true, deletedCount });
            }
            catch (error) {
                logger.error('清理 MCP Server 日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '清理日誌失敗'
                });
            }
        });
        // ============ CLI Mode API ============
        // 檢測已安裝的 CLI 工具
        this.app.get('/api/cli/detect', async (req, res) => {
            try {
                const forceRefresh = req.query['refresh'] === 'true';
                if (forceRefresh) {
                    clearDetectionCache();
                }
                const result = await detectCLITools(forceRefresh);
                res.json({ success: true, tools: result.tools, timestamp: result.timestamp });
            }
            catch (error) {
                logger.error('CLI 工具檢測失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'CLI 工具檢測失敗'
                });
            }
        });
        // 獲取 CLI 設定
        this.app.get('/api/cli/settings', (req, res) => {
            try {
                const settings = getCLISettings();
                if (!settings) {
                    res.json({ success: false, error: 'CLI 設定不存在' });
                    return;
                }
                res.json({ success: true, settings });
            }
            catch (error) {
                logger.error('獲取 CLI 設定失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取 CLI 設定失敗'
                });
            }
        });
        // 更新 CLI 設定
        this.app.put('/api/cli/settings', (req, res) => {
            try {
                const data = req.body;
                const settings = updateCLISettings(data);
                if (!settings) {
                    res.status(500).json({ success: false, error: '更新 CLI 設定失敗' });
                    return;
                }
                logger.info('更新 CLI 設定成功', { aiMode: settings.aiMode, cliTool: settings.cliTool });
                res.json({ success: true, settings });
            }
            catch (error) {
                logger.error('更新 CLI 設定失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '更新 CLI 設定失敗'
                });
            }
        });
        // 獲取所有 CLI 終端機
        this.app.get('/api/cli/terminals', (req, res) => {
            try {
                const terminals = getCLITerminals();
                res.json({ success: true, terminals });
            }
            catch (error) {
                logger.error('獲取 CLI 終端機列表失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取終端機列表失敗'
                });
            }
        });
        // 獲取單一 CLI 終端機
        this.app.get('/api/cli/terminals/:id', (req, res) => {
            try {
                const terminal = getCLITerminalById(req.params.id);
                if (!terminal) {
                    res.status(404).json({ success: false, error: '終端機不存在' });
                    return;
                }
                res.json({ success: true, terminal });
            }
            catch (error) {
                logger.error('獲取 CLI 終端機失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取終端機失敗'
                });
            }
        });
        // 刪除 CLI 終端機
        this.app.delete('/api/cli/terminals/:id', (req, res) => {
            try {
                const deleted = deleteCLITerminal(req.params.id);
                if (!deleted) {
                    res.status(404).json({ success: false, error: '終端機不存在' });
                    return;
                }
                logger.info(`刪除 CLI 終端機: ${req.params.id}`);
                res.json({ success: true });
            }
            catch (error) {
                logger.error('刪除 CLI 終端機失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '刪除終端機失敗'
                });
            }
        });
        // 獲取 CLI 終端機執行日誌
        this.app.get('/api/cli/terminals/:id/logs', (req, res) => {
            try {
                const limit = req.query['limit'] ? parseInt(req.query['limit']) : 50;
                const logs = getCLIExecutionLogs(req.params.id, limit);
                res.json({ success: true, logs });
            }
            catch (error) {
                logger.error('獲取 CLI 執行日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '獲取執行日誌失敗'
                });
            }
        });
        // 清理舊的 CLI 執行日誌
        this.app.delete('/api/cli/logs/cleanup', (req, res) => {
            try {
                const daysToKeep = req.query['daysToKeep'] ? parseInt(req.query['daysToKeep']) : 7;
                const deletedCount = cleanupOldCLIExecutionLogs(daysToKeep);
                logger.info(`清理 CLI 執行日誌: 刪除了 ${deletedCount} 筆記錄`);
                res.json({ success: true, deletedCount });
            }
            catch (error) {
                logger.error('清理 CLI 執行日誌失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '清理執行日誌失敗'
                });
            }
        });
        // 錯誤處理中介軟體
        this.app.use((error, req, res, _next) => {
            logger.error('Express錯誤:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        });
    }
    /**
     * 設定Socket.IO事件處理
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.socket('connect', socket.id);
            logger.info(`新的WebSocket連線: ${socket.id}`);
            // 記錄WebSocket連線
            performanceMonitor.recordWebSocketConnection();
            // 測試訊息處理
            socket.on('test_message', (data) => {
                logger.socket('test_message', socket.id, data);
                socket.emit('test_response', { message: 'Test message received!', timestamp: Date.now() });
            });
            // 處理會話請求（固定URL模式）
            socket.on('request_session', () => {
                logger.socket('request_session', socket.id);
                // 查找最新的活躍會話
                const activeSessions = this.sessionStorage.getAllSessions();
                let latestSession = null;
                for (const [sessionId, session] of activeSessions) {
                    if (!latestSession || session.startTime > latestSession.session.startTime) {
                        latestSession = { sessionId, session };
                    }
                }
                if (latestSession) {
                    // 有活躍會話，分配給用戶端
                    logger.info(`為用戶端 ${socket.id} 分配會話: ${latestSession.sessionId}`);
                    // 獲取專案資訊
                    let projectName;
                    let projectPath;
                    if (latestSession.session.projectId) {
                        const project = projectManager.getProject(latestSession.session.projectId);
                        if (project) {
                            projectName = project.name;
                            projectPath = project.path;
                        }
                    }
                    socket.emit('session_assigned', {
                        session_id: latestSession.sessionId,
                        work_summary: latestSession.session.workSummary,
                        timeout: latestSession.session.timeout, // 傳遞逾時時間（毫秒）
                        project_name: projectName,
                        project_path: projectPath
                    });
                }
                else {
                    // 無活躍會話
                    logger.info(`用戶端 ${socket.id} 請求會話，但無活躍會話`);
                    socket.emit('no_active_session', {
                        message: '當前無活躍的回饋會話'
                    });
                }
            });
            // 處理最新工作匯報請求
            socket.on('request_latest_summary', () => {
                logger.socket('request_latest_summary', socket.id);
                // 查找最新的活躍會話
                const activeSessions = this.sessionStorage.getAllSessions();
                let latestSession = null;
                for (const [sessionId, session] of activeSessions) {
                    if (!latestSession || session.startTime > latestSession.session.startTime) {
                        latestSession = { sessionId, session };
                    }
                }
                if (latestSession && latestSession.session.workSummary) {
                    // 找到最新的工作匯報
                    logger.info(`為用戶端 ${socket.id} 回傳最新工作匯報`);
                    socket.emit('latest_summary_response', {
                        success: true,
                        work_summary: latestSession.session.workSummary,
                        session_id: latestSession.sessionId,
                        timestamp: latestSession.session.startTime
                    });
                }
                else {
                    // 沒有找到工作匯報
                    logger.info(`用戶端 ${socket.id} 請求最新工作匯報，但未找到`);
                    socket.emit('latest_summary_response', {
                        success: false,
                        message: '暫無最新工作匯報，請等待AI呼叫collect_feedback工具函式'
                    });
                }
            });
            // 取得工作匯報資料
            socket.on('get_work_summary', (data) => {
                logger.socket('get_work_summary', socket.id, data);
                const session = this.sessionStorage.getSession(data.feedback_session_id);
                if (session) {
                    socket.emit('work_summary_data', {
                        work_summary: session.workSummary
                    });
                }
                else {
                    socket.emit('feedback_error', {
                        error: '會話不存在或已過期'
                    });
                }
            });
            // 提交回饋
            socket.on('submit_feedback', async (data) => {
                logger.socket('submit_feedback', socket.id, {
                    sessionId: data.sessionId,
                    textLength: data.text?.length || 0,
                    imageCount: data.images?.length || 0
                });
                // 清除自動回覆計時器
                this.clearAutoReplyTimers(data.sessionId);
                await this.handleFeedbackSubmission(socket, data);
            });
            // 使用者活動事件（重置計時器）
            socket.on('user_activity', (data) => {
                logger.socket('user_activity', socket.id, { sessionId: data.sessionId });
                this.resetAutoReplyTimer(socket, data.sessionId);
            });
            // 取消自動回覆
            socket.on('cancel_auto_reply', (data) => {
                logger.socket('cancel_auto_reply', socket.id, { sessionId: data.sessionId });
                this.clearAutoReplyTimers(data.sessionId);
                socket.emit('auto_reply_cancelled', { sessionId: data.sessionId });
            });
            // 當會話分配時，啟動自動回覆計時器
            socket.on('session_ready', (data) => {
                logger.socket('session_ready', socket.id, { sessionId: data.sessionId });
                this.startAutoReplyTimer(socket, data.sessionId, data.workSummary);
            });
            // 斷開連線
            socket.on('disconnect', (reason) => {
                logger.socket('disconnect', socket.id, { reason });
                logger.info(`WebSocket連線斷開: ${socket.id}, 原因: ${reason}`);
                // 記錄WebSocket斷開連線
                performanceMonitor.recordWebSocketDisconnection();
            });
        });
    }
    /**
     * 處理回饋提交
     */
    async handleFeedbackSubmission(socket, feedbackData) {
        const session = this.sessionStorage.getSession(feedbackData.sessionId);
        if (!session) {
            socket.emit('feedback_error', {
                error: '會話不存在或已過期'
            });
            return;
        }
        try {
            // 驗證回饋資料
            if (!feedbackData.text && (!feedbackData.images || feedbackData.images.length === 0)) {
                socket.emit('feedback_error', {
                    error: '請提供文字回饋或上傳圖片'
                });
                return;
            }
            // 處理圖片資料
            const processedFeedback = { ...feedbackData };
            if (feedbackData.images && feedbackData.images.length > 0) {
                logger.info(`開始處理 ${feedbackData.images.length} 張圖片...`);
                try {
                    const processedImages = await this.imageProcessor.processImages(feedbackData.images);
                    processedFeedback.images = processedImages;
                    const stats = this.imageProcessor.getImageStats(processedImages);
                    logger.info(`圖片處理完成: ${stats.totalCount} 張圖片, 總大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
                }
                catch (error) {
                    logger.error('圖片處理失敗:', error);
                    socket.emit('feedback_error', {
                        error: `圖片處理失敗: ${error instanceof Error ? error.message : '未知錯誤'}`
                    });
                    return;
                }
            }
            // 新增回饋到會話
            session.feedback.push(processedFeedback);
            this.sessionStorage.updateSession(feedbackData.sessionId, { feedback: session.feedback });
            // 通知提交成功
            socket.emit('feedback_submitted', {
                success: true,
                message: '回饋提交成功',
                shouldCloseAfterSubmit: feedbackData.shouldCloseAfterSubmit || false
            });
            // 發送 Dashboard 更新事件
            if (session.projectId) {
                this.emitDashboardSessionUpdated(session.projectId, feedbackData.sessionId, 'completed', session.workSummary);
            }
            // 完成回饋收集
            if (session.resolve) {
                session.resolve(session.feedback);
                this.sessionStorage.deleteSession(feedbackData.sessionId);
            }
        }
        catch (error) {
            logger.error('處理回饋提交時出錯:', error);
            socket.emit('feedback_error', {
                error: '伺服器處理錯誤，請稍後重試'
            });
        }
    }
    /**
     * 啟動自動回覆計時器
     */
    startAutoReplyTimer(socket, sessionId, workSummary) {
        // 清除已存在的計時器
        this.clearAutoReplyTimers(sessionId);
        // 獲取使用者偏好設定
        const preferences = getUserPreferences();
        if (!preferences.enableAutoReply) {
            logger.info(`會話 ${sessionId} 未啟用自動回覆`);
            return;
        }
        const timeoutMs = preferences.autoReplyTimeout * 1000;
        const warningMs = Math.max(timeoutMs - 60000, timeoutMs * 0.8); // 最後 60 秒或 80% 時間點
        logger.info(`啟動自動回覆計時器: 會話 ${sessionId}, 超時 ${preferences.autoReplyTimeout} 秒`);
        // 設置警告計時器
        const warningTimer = setTimeout(() => {
            const remainingSeconds = Math.round((timeoutMs - warningMs) / 1000);
            logger.info(`發送自動回覆警告: 會話 ${sessionId}, 剩餘 ${remainingSeconds} 秒`);
            socket.emit('auto_reply_warning', { remainingSeconds });
        }, warningMs);
        this.autoReplyWarningTimers.set(sessionId, warningTimer);
        // 設置自動回覆計時器
        const autoReplyTimer = setTimeout(async () => {
            logger.info(`觸發自動回覆: 會話 ${sessionId}`);
            try {
                // 生成 AI 回覆
                const result = await generateAIReply({
                    aiMessage: workSummary,
                    userContext: '使用者未在時間內回應，系統自動生成回覆'
                });
                if (result.success && result.reply) {
                    logger.info(`自動回覆生成成功: 會話 ${sessionId}`);
                    socket.emit('auto_reply_triggered', { reply: result.reply });
                }
                else {
                    logger.error(`自動回覆生成失敗: 會話 ${sessionId}`, result.error);
                    socket.emit('auto_reply_error', { error: result.error || '自動回覆生成失敗' });
                }
            }
            catch (error) {
                logger.error(`自動回覆發生錯誤: 會話 ${sessionId}`, error);
                socket.emit('auto_reply_error', { error: '自動回覆發生錯誤' });
            }
            // 清除計時器
            this.clearAutoReplyTimers(sessionId);
        }, timeoutMs);
        this.autoReplyTimers.set(sessionId, autoReplyTimer);
    }
    /**
     * 重置自動回覆計時器
     */
    resetAutoReplyTimer(socket, sessionId) {
        const session = this.sessionStorage.getSession(sessionId);
        if (!session) {
            logger.warn(`嘗試重置不存在的會話計時器: ${sessionId}`);
            return;
        }
        logger.debug(`重置自動回覆計時器: 會話 ${sessionId}`);
        this.startAutoReplyTimer(socket, sessionId, session.workSummary || '');
    }
    /**
     * 清除自動回覆計時器
     */
    clearAutoReplyTimers(sessionId) {
        const warningTimer = this.autoReplyWarningTimers.get(sessionId);
        if (warningTimer) {
            clearTimeout(warningTimer);
            this.autoReplyWarningTimers.delete(sessionId);
            logger.debug(`清除警告計時器: 會話 ${sessionId}`);
        }
        const autoReplyTimer = this.autoReplyTimers.get(sessionId);
        if (autoReplyTimer) {
            clearTimeout(autoReplyTimer);
            this.autoReplyTimers.delete(sessionId);
            logger.debug(`清除自動回覆計時器: 會話 ${sessionId}`);
        }
    }
    /**
     * 收集使用者回饋
     */
    async collectFeedback(workSummary, timeoutSeconds, projectName, projectPath) {
        const sessionId = this.generateSessionId();
        // 取得或建立專案
        const project = projectName
            ? projectManager.getOrCreateProject(projectName, projectPath)
            : projectManager.getDefaultProject();
        logger.info(`建立回饋會話: ${sessionId}, 逾時: ${timeoutSeconds}秒, 專案: ${project.name} (${project.id})`);
        const feedbackUrl = this.generateFeedbackUrl(sessionId);
        return new Promise((resolve, reject) => {
            // 建立會話
            const session = {
                workSummary,
                feedback: [],
                startTime: Date.now(),
                timeout: timeoutSeconds * 1000,
                projectId: project.id,
                projectName: project.name,
                resolve: (feedback = []) => resolve({
                    feedback,
                    sessionId,
                    feedbackUrl,
                    projectId: project.id,
                    projectName: project.name
                }),
                reject
            };
            this.sessionStorage.createSession(sessionId, session);
            // 發送 Dashboard 事件
            this.emitDashboardSessionCreated(project.id, sessionId, project.name, workSummary);
            // 发送MCP日志通知，包含反馈页面信息
            logger.mcpFeedbackPageCreated(sessionId, feedbackUrl, timeoutSeconds);
            // 注意：逾時處理現在由SessionStorage的清理機制處理
            // 開啟瀏覽器
            this.openFeedbackPage(sessionId).catch((error) => {
                logger.error('開啟回饋頁面失敗:', error);
                this.sessionStorage.deleteSession(sessionId);
                reject(error);
            });
        });
    }
    emitDashboardSessionCreated(projectId, sessionId, projectName, workSummary) {
        if (this.io) {
            this.io.emit('dashboard:session_created', {
                projectId,
                sessionId,
                projectName,
                workSummary
            });
        }
    }
    emitDashboardSessionUpdated(projectId, sessionId, status, workSummary) {
        if (this.io) {
            this.io.emit('dashboard:session_updated', {
                projectId,
                sessionId,
                status,
                workSummary
            });
        }
    }
    /**
     * 產生回饋頁面URL
     */
    generateFeedbackUrl(sessionId) {
        // 如果啟用了固定URL模式，回傳根路徑
        if (this.config.useFixedUrl) {
            // 優先使用設定的伺服器基礎URL
            if (this.config.serverBaseUrl) {
                return this.config.serverBaseUrl;
            }
            // 使用設定的主機名
            const host = this.config.serverHost || 'localhost';
            return `http://${host}:${this.port}`;
        }
        // 傳統模式：包含會話ID參數
        if (this.config.serverBaseUrl) {
            return `${this.config.serverBaseUrl}/?mode=feedback&session=${sessionId}`;
        }
        const host = this.config.serverHost || 'localhost';
        return `http://${host}:${this.port}/?mode=feedback&session=${sessionId}`;
    }
    /**
     * 開啟回饋頁面
     */
    async openFeedbackPage(sessionId) {
        const url = this.generateFeedbackUrl(sessionId);
        logger.info(`開啟回饋頁面: ${url}`);
        try {
            const open = await import('open');
            await open.default(url);
            logger.info('瀏覽器已開啟回饋頁面');
        }
        catch (error) {
            logger.warn('無法自動開啟瀏覽器:', error);
            logger.info(`請手動開啟瀏覽器存取: ${url}`);
        }
    }
    /**
     * 產生會話ID
     */
    generateSessionId() {
        return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 啟動Web伺服器
     */
    /**
     * 自動啟動已啟用的 MCP Servers
     * 在服務啟動時自動連接所有已設定並啟用的 MCP Servers
     */
    async autoStartMCPServers() {
        try {
            const enabledServers = getEnabledMCPServers();
            if (enabledServers.length === 0) {
                logger.info('沒有已啟用的 MCP Servers 需要自動啟動');
                return;
            }
            logger.info(`開始自動啟動 ${enabledServers.length} 個已啟用的 MCP Servers...`);
            // 使用 Promise.allSettled 並行啟動所有 MCP Servers（非阻塞）
            const results = await Promise.allSettled(enabledServers.map(config => mcpClientManager.connect(config)));
            // 統計結果
            let successCount = 0;
            let failureCount = 0;
            results.forEach((result, index) => {
                const config = enabledServers[index];
                if (!config)
                    return; // 安全檢查
                if (result.status === 'fulfilled') {
                    if (result.value.status === 'connected') {
                        successCount++;
                        logger.info(`✓ MCP Server 自動啟動成功: ${config.name} (ID: ${config.id})`);
                    }
                    else if (result.value.status === 'error') {
                        failureCount++;
                        logger.error(`✗ MCP Server 自動啟動失敗: ${config.name} (ID: ${config.id}) - ${result.value.error || '未知錯誤'}`);
                    }
                }
                else {
                    failureCount++;
                    const errorMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
                    logger.error(`✗ MCP Server 自動啟動失敗: ${config.name} (ID: ${config.id}) - ${errorMsg}`);
                }
            });
            logger.info(`MCP Server 自動啟動完成 - 成功: ${successCount}, 失敗: ${failureCount}`);
        }
        catch (error) {
            // 捕獲任何意外錯誤，但不影響服務啟動
            logger.error('MCP Server 自動啟動過程中發生錯誤:', error);
        }
    }
    async start() {
        if (this.isServerRunning) {
            logger.warn('Web伺服器已在執行中');
            return;
        }
        try {
            // 根據設定選擇連接埠策略
            if (this.config.forcePort) {
                // 強制連接埠模式
                logger.info(`強制連接埠模式: 嘗試使用連接埠 ${this.config.webPort}`);
                // 根據設定決定是否清理連接埠
                if (this.config.cleanupPortOnStart) {
                    logger.info(`啟動時連接埠清理已啟用，清理連接埠 ${this.config.webPort}`);
                    await this.portManager.cleanupPort(this.config.webPort);
                }
                this.port = await this.portManager.forcePort(this.config.webPort, this.config.killProcessOnPortConflict || false);
            }
            else {
                // 智慧連接埠模式：使用新的衝突解決方案
                logger.info(`智慧連接埠模式: 嘗試使用連接埠 ${this.config.webPort}`);
                this.port = await this.portManager.resolvePortConflict(this.config.webPort);
            }
            // 啟動伺服器前再次確認連接埠可用
            logger.info(`準備在連接埠 ${this.port} 啟動伺服器...`);
            // 啟動伺服器
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Server start timeout'));
                }, 10000);
                this.server.listen(this.port, (error) => {
                    clearTimeout(timeout);
                    if (error) {
                        reject(error);
                    }
                    else {
                        // 獲取實際監聽的連接埠（當 port 為 0 時系統會分配隨機連接埠）
                        const address = this.server.address();
                        if (address && typeof address === 'object') {
                            this.port = address.port;
                        }
                        resolve();
                    }
                });
            });
            this.isServerRunning = true;
            // 根據設定顯示不同的啟動資訊
            const serverUrl = `http://localhost:${this.port}`;
            if (this.config.forcePort) {
                logger.info(`Web伺服器啟動成功 (強制連接埠): ${serverUrl}`);
            }
            else {
                logger.info(`Web伺服器啟動成功: ${serverUrl}`);
            }
            if (this.config.useFixedUrl) {
                logger.info(`固定URL模式已啟用，存取位址: ${serverUrl}`);
            }
            // 发送MCP日志通知，包含端口和URL信息
            logger.mcpServerStarted(this.port, serverUrl);
            // 自動啟動已啟用的 MCP Servers
            await this.autoStartMCPServers();
        }
        catch (error) {
            logger.error('Web伺服器啟動失敗:', error);
            throw new MCPError('Failed to start web server', 'WEB_SERVER_START_ERROR', error);
        }
    }
    /**
     * 優雅停止Web伺服器
     */
    async gracefulStop() {
        if (!this.isServerRunning) {
            return;
        }
        const currentPort = this.port;
        logger.info(`開始優雅停止Web伺服器 (連接埠: ${currentPort})...`);
        try {
            // 1. 停止接受新連線
            if (this.server) {
                this.server.close();
            }
            // 2. 通知所有客户端即将关闭
            if (this.io) {
                this.io.emit('server_shutdown', {
                    message: '服务器即将关闭',
                    timestamp: new Date().toISOString()
                });
                // 等待用戶端處理關閉通知
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // 3. 關閉所有Socket連線
            if (this.io) {
                this.io.close();
            }
            // 4. 清理所有自動回覆計時器
            for (const sessionId of this.autoReplyTimers.keys()) {
                this.clearAutoReplyTimers(sessionId);
            }
            // 5. 清理會話資料
            this.sessionStorage.clear();
            this.sessionStorage.stopCleanupTimer();
            // 6. 等待所有非同步操作完成
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.isServerRunning = false;
            logger.info(`Web伺服器已優雅停止 (連接埠: ${currentPort})`);
        }
        catch (error) {
            logger.error('優雅停止Web伺服器時出錯:', error);
            // 即使出錯也要標記為已停止
            this.isServerRunning = false;
            throw error;
        }
    }
    /**
     * 停止Web伺服器
     */
    async stop() {
        if (!this.isServerRunning) {
            return;
        }
        const currentPort = this.port;
        logger.info(`正在停止Web伺服器 (連接埠: ${currentPort})...`);
        try {
            // 如果有活躍會話，先等待一段時間以便使用者提交
            const active = this.sessionStorage.getSessionCount();
            if (active > 0) {
                // 使用 dialogTimeout（秒）的值，最多 5 分鐘
                const waitMs = Math.min(this.config.dialogTimeout * 1000, 5 * 60 * 1000);
                logger.info(`檢測到 ${active} 個活躍會話，將等待最多 ${Math.round(waitMs / 1000)} 秒以便使用者提交回饋`);
                try {
                    await this.waitForActiveSessions(waitMs);
                    logger.info('活躍會話已完成，繼續停止流程');
                }
                catch (waitErr) {
                    logger.warn('等待活躍會話完成時發生錯誤或超時，將繼續停止流程', waitErr);
                }
            }
            // 清理所有活躍會話
            this.sessionStorage.clear();
            this.sessionStorage.stopCleanupTimer();
            // 關閉所有WebSocket連線
            this.io.disconnectSockets(true);
            // 關閉Socket.IO
            this.io.close();
            // 關閉HTTP伺服器
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Server close timeout'));
                }, 5000);
                this.server.close((error) => {
                    clearTimeout(timeout);
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve();
                    }
                });
            });
            this.isServerRunning = false;
            logger.info(`Web伺服器已停止 (連接埠: ${currentPort})`);
            // 等待連接埠完全釋放
            logger.info(`等待連接埠 ${currentPort} 完全釋放...`);
            try {
                await this.portManager.waitForPortRelease(currentPort, 3000);
                logger.info(`連接埠 ${currentPort} 已完全釋放`);
            }
            catch (error) {
                logger.warn(`連接埠 ${currentPort} 釋放逾時，但伺服器已停止`);
            }
        }
        catch (error) {
            logger.error('停止Web伺服器時出錯:', error);
            throw error;
        }
    }
    /**
     * 檢查伺服器是否執行
     */
    isRunning() {
        return this.isServerRunning;
    }
    /**
     * 取得伺服器連接埠
     */
    getPort() {
        return this.port;
    }
}
//# sourceMappingURL=web-server.js.map