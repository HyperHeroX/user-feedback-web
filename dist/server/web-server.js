/**
 * user-feedback MCP Tools - Web服务器实现
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import { MCPError } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { PortManager } from '../utils/port-manager.js';
import { ImageProcessor } from '../utils/image-processor.js';
import { ImageToTextService } from '../utils/image-to-text-service.js';
import { performanceMonitor } from '../utils/performance-monitor.js';
import { SessionStorage } from '../utils/session-storage.js';
import { VERSION } from '../index.js';
import { initDatabase, getAllPrompts, createPrompt, updatePrompt, deletePrompt, togglePromptPin, reorderPrompts, getPinnedPrompts, getAISettings, updateAISettings, getUserPreferences, updateUserPreferences } from '../utils/database.js';
import { maskApiKey } from '../utils/crypto-helper.js';
import { generateAIReply, validateAPIKey } from '../utils/ai-service.js';
/**
 * Web服务器类
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
        // 创建Express应用
        this.app = express();
        // 创建HTTP服务器
        this.server = createServer(this.app);
        // 创建Socket.IO服务器
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
     * 设置优雅退出处理
     */
    setupGracefulShutdown() {
        let isShuttingDown = false;
        // 注册退出信号处理
        const gracefulShutdown = async (signal) => {
            if (isShuttingDown) {
                logger.warn(`已在关闭过程中，忽略 ${signal} 信号`);
                return;
            }
            isShuttingDown = true;
            logger.info(`收到 ${signal} 信号，开始优雅关闭...`);
            try {
                await this.gracefulStop();
                logger.info('优雅关闭完成');
                process.exit(0);
            }
            catch (error) {
                logger.error('优雅关闭失败:', error);
                process.exit(1);
            }
        };
        // 标准退出信号
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        // Windows特有的退出信号
        if (process.platform === 'win32') {
            process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
        }
        // 未捕获的异常
        process.on('uncaughtException', async (error) => {
            if (isShuttingDown)
                return;
            isShuttingDown = true;
            logger.error('未捕获的异常:', error);
            try {
                await this.gracefulStop();
            }
            catch (stopError) {
                logger.error('异常退出时清理失败:', stopError);
            }
            process.exit(1);
        });
        // 未处理的Promise拒绝 - 只记录，不退出
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('未处理的Promise拒绝:', reason);
            logger.debug('Promise:', promise);
            // 不要因为Promise拒绝就退出程序，这在MCP环境中很常见
        });
    }
    /**
     * 设置中间件
     */
    setupMiddleware() {
        // 安全中间件
        this.app.use(helmet({
            contentSecurityPolicy: false // 允许内联脚本
        }));
        // 压缩中间件
        this.app.use(compression());
        // CORS中间件
        this.app.use(cors({
            origin: this.config.corsOrigin,
            credentials: true
        }));
        // JSON解析中间件
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        // 请求日志和性能监控中间件
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                const success = res.statusCode < 400;
                // 记录请求日志
                logger.request(req.method, req.url, res.statusCode, duration);
                // 记录性能指标
                performanceMonitor.recordRequest(duration, success);
                // 记录慢请求
                if (duration > 1000) {
                    logger.warn(`慢请求: ${req.method} ${req.path} - ${duration}ms`);
                }
            });
            next();
        });
    }
    /**
     * 设置路由
     */
    setupRoutes() {
        // 获取当前文件的目录路径（ES模块兼容）
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const staticPath = path.resolve(__dirname, '../static');
        // 静态文件服务 - 使用绝对路径
        this.app.use(express.static(staticPath));
        // 主页路由
        this.app.get('/', (req, res) => {
            res.sendFile('index.html', { root: staticPath });
        });
        // API配置路由
        this.app.get('/api/config', (req, res) => {
            const chatConfig = {
                api_key: this.config.apiKey || '',
                api_base_url: this.config.apiBaseUrl || 'https://api.openai.com/v1',
                model: this.config.defaultModel || 'gpt-4o-mini',
                enable_chat: this.config.enableChat !== false, // 默认启用
                max_file_size: this.config.maxFileSize,
                dialog_timeout: this.config.dialogTimeout, // MCP_DIALOG_TIMEOUT (毫秒)
                temperature: 0.7,
                max_tokens: 2000
            };
            logger.info('返回聊天配置:', {
                hasApiKey: !!chatConfig.api_key,
                apiBaseUrl: chatConfig.api_base_url,
                model: chatConfig.model,
                enableChat: chatConfig.enable_chat,
                dialogTimeout: chatConfig.dialog_timeout
            });
            res.json(chatConfig);
        });
        // 测试会话创建路由
        this.app.post('/api/test-session', (req, res) => {
            const { work_summary, timeout_seconds = 300 } = req.body;
            if (!work_summary) {
                res.status(400).json({ error: '缺少work_summary参数' });
                return;
            }
            const sessionId = this.generateSessionId();
            // 创建测试会话
            const session = {
                workSummary: work_summary,
                feedback: [],
                startTime: Date.now(),
                timeout: timeout_seconds * 1000
            };
            this.sessionStorage.createSession(sessionId, session);
            // 记录会话创建
            performanceMonitor.recordSessionCreated();
            logger.info(`创建测试会话: ${sessionId}`);
            res.json({
                success: true,
                session_id: sessionId,
                feedback_url: this.generateFeedbackUrl(sessionId)
            });
        });
        // 版本信息API
        this.app.get('/api/version', (req, res) => {
            res.json({
                version: VERSION,
                timestamp: new Date().toISOString()
            });
        });
        // 健康检查路由
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
        // 性能监控路由
        this.app.get('/api/metrics', (req, res) => {
            const metrics = performanceMonitor.getMetrics();
            res.json(metrics);
        });
        // 性能报告路由
        this.app.get('/api/performance-report', (req, res) => {
            const report = performanceMonitor.getFormattedReport();
            res.type('text/plain').send(report);
        });
        // 图片转文字API
        this.app.post('/api/convert-images', async (req, res) => {
            try {
                const { images } = req.body;
                if (!images || !Array.isArray(images) || images.length === 0) {
                    res.status(400).json({
                        success: false,
                        error: '请提供要转换的图片数据'
                    });
                    return;
                }
                // 检查功能是否启用
                if (!this.imageToTextService.isEnabled()) {
                    res.status(400).json({
                        success: false,
                        error: '图片转文字功能未启用或API密钥未配置'
                    });
                    return;
                }
                logger.info(`开始转换 ${images.length} 张图片为文字`);
                // 批量转换图片
                const descriptions = await this.imageToTextService.convertMultipleImages(images);
                logger.info(`图片转文字完成，共转换 ${descriptions.length} 张图片`);
                res.json({
                    success: true,
                    descriptions
                });
            }
            catch (error) {
                logger.error('图片转文字API错误:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '图片转文字处理失败'
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
                        temperature: settings.temperature,
                        maxTokens: settings.maxTokens,
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
                        temperature: settings.temperature,
                        maxTokens: settings.maxTokens,
                        createdAt: settings.createdAt,
                        updatedAt: settings.updatedAt
                    }
                };
                res.json(response);
            }
            catch (error) {
                logger.error('更新 AI 設定失敗:', error);
                res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : '更新 AI 設定失敗'
                });
            }
        });
        // 驗證 API Key
        this.app.post('/api/ai-settings/validate', async (req, res) => {
            try {
                const { apiKey, model } = req.body;
                if (!apiKey || !model) {
                    res.status(400).json({
                        success: false,
                        error: 'API Key 和模型為必填欄位'
                    });
                    return;
                }
                const result = await validateAPIKey(apiKey, model);
                if (result.valid) {
                    logger.info('API Key 驗證成功');
                    res.json({ success: true, valid: true });
                }
                else {
                    logger.warn('API Key 驗證失敗:', result.error);
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
                    error: error instanceof Error ? error.message : '更新使用者偏好設定失敗'
                });
            }
        });
        // 错误处理中间件
        this.app.use((error, req, res, next) => {
            logger.error('Express错误:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: error.message
            });
        });
    }
    /**
     * 设置Socket.IO事件处理
     */
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.socket('connect', socket.id);
            logger.info(`新的WebSocket连接: ${socket.id}`);
            // 记录WebSocket连接
            performanceMonitor.recordWebSocketConnection();
            // 测试消息处理
            socket.on('test_message', (data) => {
                logger.socket('test_message', socket.id, data);
                socket.emit('test_response', { message: 'Test message received!', timestamp: Date.now() });
            });
            // 处理会话请求（固定URL模式）
            socket.on('request_session', () => {
                logger.socket('request_session', socket.id);
                // 查找最新的活跃会话
                const activeSessions = this.sessionStorage.getAllSessions();
                let latestSession = null;
                for (const [sessionId, session] of activeSessions) {
                    if (!latestSession || session.startTime > latestSession.session.startTime) {
                        latestSession = { sessionId, session };
                    }
                }
                if (latestSession) {
                    // 有活跃会话，分配给客户端
                    logger.info(`为客户端 ${socket.id} 分配会话: ${latestSession.sessionId}`);
                    socket.emit('session_assigned', {
                        session_id: latestSession.sessionId,
                        work_summary: latestSession.session.workSummary,
                        timeout: latestSession.session.timeout // 传递超时时间（毫秒）
                    });
                }
                else {
                    // 无活跃会话
                    logger.info(`客户端 ${socket.id} 请求会话，但无活跃会话`);
                    socket.emit('no_active_session', {
                        message: '当前无活跃的反馈会话'
                    });
                }
            });
            // 处理最新工作汇报请求
            socket.on('request_latest_summary', () => {
                logger.socket('request_latest_summary', socket.id);
                // 查找最新的活跃会话
                const activeSessions = this.sessionStorage.getAllSessions();
                let latestSession = null;
                for (const [sessionId, session] of activeSessions) {
                    if (!latestSession || session.startTime > latestSession.session.startTime) {
                        latestSession = { sessionId, session };
                    }
                }
                if (latestSession && latestSession.session.workSummary) {
                    // 找到最新的工作汇报
                    logger.info(`为客户端 ${socket.id} 返回最新工作汇报`);
                    socket.emit('latest_summary_response', {
                        success: true,
                        work_summary: latestSession.session.workSummary,
                        session_id: latestSession.sessionId,
                        timestamp: latestSession.session.startTime
                    });
                }
                else {
                    // 没有找到工作汇报
                    logger.info(`客户端 ${socket.id} 请求最新工作汇报，但未找到`);
                    socket.emit('latest_summary_response', {
                        success: false,
                        message: '暂无最新工作汇报，请等待AI调用collect_feedback工具函数'
                    });
                }
            });
            // 获取工作汇报数据
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
                        error: '会话不存在或已过期'
                    });
                }
            });
            // 提交反馈
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
            // 断开连接
            socket.on('disconnect', (reason) => {
                logger.socket('disconnect', socket.id, { reason });
                logger.info(`WebSocket连接断开: ${socket.id}, 原因: ${reason}`);
                // 记录WebSocket断开连接
                performanceMonitor.recordWebSocketDisconnection();
            });
        });
    }
    /**
     * 处理反馈提交
     */
    async handleFeedbackSubmission(socket, feedbackData) {
        const session = this.sessionStorage.getSession(feedbackData.sessionId);
        if (!session) {
            socket.emit('feedback_error', {
                error: '会话不存在或已过期'
            });
            return;
        }
        try {
            // 验证反馈数据
            if (!feedbackData.text && (!feedbackData.images || feedbackData.images.length === 0)) {
                socket.emit('feedback_error', {
                    error: '请提供文字反馈或上传图片'
                });
                return;
            }
            // 处理图片数据
            let processedFeedback = { ...feedbackData };
            if (feedbackData.images && feedbackData.images.length > 0) {
                logger.info(`开始处理 ${feedbackData.images.length} 张图片...`);
                try {
                    const processedImages = await this.imageProcessor.processImages(feedbackData.images);
                    processedFeedback.images = processedImages;
                    const stats = this.imageProcessor.getImageStats(processedImages);
                    logger.info(`图片处理完成: ${stats.totalCount} 张图片, 总大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);
                }
                catch (error) {
                    logger.error('图片处理失败:', error);
                    socket.emit('feedback_error', {
                        error: `图片处理失败: ${error instanceof Error ? error.message : '未知错误'}`
                    });
                    return;
                }
            }
            // 添加反馈到会话
            session.feedback.push(processedFeedback);
            this.sessionStorage.updateSession(feedbackData.sessionId, { feedback: session.feedback });
            // 通知提交成功
            socket.emit('feedback_submitted', {
                success: true,
                message: '反馈提交成功',
                shouldCloseAfterSubmit: feedbackData.shouldCloseAfterSubmit || false
            });
            // 完成反馈收集
            if (session.resolve) {
                session.resolve(session.feedback);
                this.sessionStorage.deleteSession(feedbackData.sessionId);
            }
        }
        catch (error) {
            logger.error('处理反馈提交时出错:', error);
            socket.emit('feedback_error', {
                error: '服务器处理错误，请稍后重试'
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
     * 收集用户反馈
     */
    async collectFeedback(workSummary, timeoutSeconds) {
        const sessionId = this.generateSessionId();
        logger.info(`创建反馈会话: ${sessionId}, 超时: ${timeoutSeconds}秒`);
        return new Promise((resolve, reject) => {
            // 创建会话
            const session = {
                workSummary,
                feedback: [],
                startTime: Date.now(),
                timeout: timeoutSeconds * 1000,
                resolve,
                reject
            };
            this.sessionStorage.createSession(sessionId, session);
            // 生成反馈页面URL
            const feedbackUrl = this.generateFeedbackUrl(sessionId);
            // 发送MCP日志通知，包含反馈页面信息
            logger.mcpFeedbackPageCreated(sessionId, feedbackUrl, timeoutSeconds);
            // 注意：超时处理现在由SessionStorage的清理机制处理
            // 打开浏览器
            this.openFeedbackPage(sessionId).catch(error => {
                logger.error('打开反馈页面失败:', error);
                this.sessionStorage.deleteSession(sessionId);
                reject(error);
            });
        });
    }
    /**
     * 生成反馈页面URL
     */
    generateFeedbackUrl(sessionId) {
        // 如果启用了固定URL模式，返回根路径
        if (this.config.useFixedUrl) {
            // 优先使用配置的服务器基础URL
            if (this.config.serverBaseUrl) {
                return this.config.serverBaseUrl;
            }
            // 使用配置的主机名
            const host = this.config.serverHost || 'localhost';
            return `http://${host}:${this.port}`;
        }
        // 传统模式：包含会话ID参数
        if (this.config.serverBaseUrl) {
            return `${this.config.serverBaseUrl}/?mode=feedback&session=${sessionId}`;
        }
        const host = this.config.serverHost || 'localhost';
        return `http://${host}:${this.port}/?mode=feedback&session=${sessionId}`;
    }
    /**
     * 打开反馈页面
     */
    async openFeedbackPage(sessionId) {
        const url = this.generateFeedbackUrl(sessionId);
        logger.info(`打开反馈页面: ${url}`);
        try {
            const open = await import('open');
            await open.default(url);
            logger.info('浏览器已打开反馈页面');
        }
        catch (error) {
            logger.warn('无法自动打开浏览器:', error);
            logger.info(`请手动打开浏览器访问: ${url}`);
        }
    }
    /**
     * 生成会话ID
     */
    generateSessionId() {
        return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * 启动Web服务器
     */
    async start() {
        if (this.isServerRunning) {
            logger.warn('Web服务器已在运行中');
            return;
        }
        try {
            // 根据配置选择端口策略
            if (this.config.forcePort) {
                // 强制端口模式
                logger.info(`强制端口模式: 尝试使用端口 ${this.config.webPort}`);
                // 根据配置决定是否清理端口
                if (this.config.cleanupPortOnStart) {
                    logger.info(`启动时端口清理已启用，清理端口 ${this.config.webPort}`);
                    await this.portManager.cleanupPort(this.config.webPort);
                }
                this.port = await this.portManager.forcePort(this.config.webPort, this.config.killProcessOnPortConflict || false);
            }
            else {
                // 智能端口模式：使用新的冲突解决方案
                logger.info(`智能端口模式: 尝试使用端口 ${this.config.webPort}`);
                this.port = await this.portManager.resolvePortConflict(this.config.webPort);
            }
            // 启动服务器前再次确认端口可用
            logger.info(`准备在端口 ${this.port} 启动服务器...`);
            // 启动服务器
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
                        resolve();
                    }
                });
            });
            this.isServerRunning = true;
            // 根据配置显示不同的启动信息
            const serverUrl = `http://localhost:${this.port}`;
            if (this.config.forcePort) {
                logger.info(`Web服务器启动成功 (强制端口): ${serverUrl}`);
            }
            else {
                logger.info(`Web服务器启动成功: ${serverUrl}`);
            }
            if (this.config.useFixedUrl) {
                logger.info(`固定URL模式已启用，访问地址: ${serverUrl}`);
            }
            // 发送MCP日志通知，包含端口和URL信息
            logger.mcpServerStarted(this.port, serverUrl);
        }
        catch (error) {
            logger.error('Web服务器启动失败:', error);
            throw new MCPError('Failed to start web server', 'WEB_SERVER_START_ERROR', error);
        }
    }
    /**
     * 优雅停止Web服务器
     */
    async gracefulStop() {
        if (!this.isServerRunning) {
            return;
        }
        const currentPort = this.port;
        logger.info(`开始优雅停止Web服务器 (端口: ${currentPort})...`);
        try {
            // 1. 停止接受新连接
            if (this.server) {
                this.server.close();
            }
            // 2. 通知所有客户端即将关闭
            if (this.io) {
                this.io.emit('server_shutdown', {
                    message: '服务器即将关闭',
                    timestamp: new Date().toISOString()
                });
                // 等待客户端处理关闭通知
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // 3. 关闭所有Socket连接
            if (this.io) {
                this.io.close();
            }
            // 4. 清理所有自動回覆計時器
            for (const sessionId of this.autoReplyTimers.keys()) {
                this.clearAutoReplyTimers(sessionId);
            }
            // 5. 清理会话数据
            this.sessionStorage.clear();
            this.sessionStorage.stopCleanupTimer();
            // 6. 等待所有异步操作完成
            await new Promise(resolve => setTimeout(resolve, 2000));
            this.isServerRunning = false;
            logger.info(`Web服务器已优雅停止 (端口: ${currentPort})`);
        }
        catch (error) {
            logger.error('优雅停止Web服务器时出错:', error);
            // 即使出错也要标记为已停止
            this.isServerRunning = false;
            throw error;
        }
    }
    /**
     * 停止Web服务器
     */
    async stop() {
        if (!this.isServerRunning) {
            return;
        }
        const currentPort = this.port;
        logger.info(`正在停止Web服务器 (端口: ${currentPort})...`);
        try {
            // 清理所有活跃会话
            this.sessionStorage.clear();
            this.sessionStorage.stopCleanupTimer();
            // 关闭所有WebSocket连接
            this.io.disconnectSockets(true);
            // 关闭Socket.IO
            this.io.close();
            // 关闭HTTP服务器
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
            logger.info(`Web服务器已停止 (端口: ${currentPort})`);
            // 等待端口完全释放
            logger.info(`等待端口 ${currentPort} 完全释放...`);
            try {
                await this.portManager.waitForPortRelease(currentPort, 3000);
                logger.info(`端口 ${currentPort} 已完全释放`);
            }
            catch (error) {
                logger.warn(`端口 ${currentPort} 释放超时，但服务器已停止`);
            }
        }
        catch (error) {
            logger.error('停止Web服务器时出错:', error);
            throw error;
        }
    }
    /**
     * 检查服务器是否运行
     */
    isRunning() {
        return this.isServerRunning;
    }
    /**
     * 获取服务器端口
     */
    getPort() {
        return this.port;
    }
}
//# sourceMappingURL=web-server.js.map