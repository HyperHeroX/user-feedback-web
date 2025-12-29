/**
 * MCP Client Manager
 * 管理與 MCP Server 的連接
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventEmitter } from 'events';
import { logger } from './logger.js';
import { getToolEnableConfigs, isToolEnabled, insertMCPServerLog, getMCPServerById } from './database.js';
class MCPClientManager extends EventEmitter {
    static instance;
    clients = new Map();
    reconnectConfig = {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 30000,
        enabled: true
    };
    constructor() {
        super();
    }
    static getInstance() {
        if (!MCPClientManager.instance) {
            MCPClientManager.instance = new MCPClientManager();
        }
        return MCPClientManager.instance;
    }
    setReconnectConfig(config) {
        this.reconnectConfig = { ...this.reconnectConfig, ...config };
    }
    getReconnectConfig() {
        return { ...this.reconnectConfig };
    }
    async connect(config, isReconnect = false) {
        if (this.clients.has(config.id)) {
            const existing = this.clients.get(config.id);
            if (existing.state.status === 'connected') {
                return existing.state;
            }
            if (existing.reconnectTimer) {
                clearTimeout(existing.reconnectTimer);
            }
            await this.disconnect(config.id, true);
        }
        const state = {
            id: config.id,
            status: 'connecting',
            tools: [],
            resources: [],
            prompts: [],
            reconnectAttempts: isReconnect ? (this.clients.get(config.id)?.state.reconnectAttempts ?? 0) + 1 : 0,
            maxReconnectAttempts: this.reconnectConfig.maxAttempts
        };
        try {
            const transport = await this.createTransport(config);
            const client = new Client({ name: 'user-feedback-mcp-client', version: '1.0.0' }, { capabilities: {} });
            await client.connect(transport);
            const instance = { client, transport, state, config };
            this.setupTransportHandlers(config.id, config.name, transport, instance);
            instance.state.status = 'connected';
            instance.state.connectedAt = new Date().toISOString();
            instance.state.error = undefined;
            instance.state.lastError = undefined;
            instance.state.reconnectAttempts = 0;
            instance.state.tools = await this.fetchTools(client);
            instance.state.resources = await this.fetchResources(client);
            instance.state.prompts = await this.fetchPrompts(client);
            this.clients.set(config.id, instance);
            logger.info(`MCP Server connected: ${config.name} (ID: ${config.id})`);
            insertMCPServerLog({
                serverId: config.id,
                serverName: config.name,
                type: 'connect',
                message: isReconnect ? `重連成功，工具數量: ${instance.state.tools.length}` : `連線成功，工具數量: ${instance.state.tools.length}`,
                details: JSON.stringify({
                    toolCount: instance.state.tools.length,
                    resourceCount: instance.state.resources.length,
                    promptCount: instance.state.prompts.length,
                    isReconnect
                })
            });
            this.emit('server:connected', { serverId: config.id, serverName: config.name, state: instance.state });
            this.emit('server:state-changed', { serverId: config.id, state: instance.state });
            return instance.state;
        }
        catch (error) {
            state.status = 'error';
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            state.error = errorMessage;
            state.errorDetails = errorStack;
            state.lastError = errorMessage;
            state.lastErrorAt = new Date().toISOString();
            logger.error(`Failed to connect MCP Server ${config.name}:`, error);
            insertMCPServerLog({
                serverId: config.id,
                serverName: config.name,
                type: 'error',
                message: `連線失敗: ${errorMessage}`,
                details: JSON.stringify({
                    command: config.command,
                    args: config.args,
                    transport: config.transport,
                    error: errorMessage,
                    stack: errorStack,
                    attempt: state.reconnectAttempts
                })
            });
            this.emit('server:error', {
                serverId: config.id,
                serverName: config.name,
                error: errorMessage,
                details: errorStack
            });
            const tempInstance = {
                client: null,
                transport: null,
                state,
                config
            };
            this.clients.set(config.id, tempInstance);
            if (this.reconnectConfig.enabled && (state.reconnectAttempts ?? 0) < this.reconnectConfig.maxAttempts) {
                this.scheduleReconnect(config, state.reconnectAttempts ?? 0);
            }
            this.emit('server:state-changed', { serverId: config.id, state });
            return state;
        }
    }
    async disconnect(serverId, skipEvent = false) {
        const instance = this.clients.get(serverId);
        if (!instance)
            return;
        if (instance.reconnectTimer) {
            clearTimeout(instance.reconnectTimer);
        }
        const serverName = instance.config?.name ?? `Server ${instance.state.id}`;
        try {
            if (instance.client) {
                await instance.client.close();
            }
            logger.info(`MCP Server disconnected: ID ${serverId}`);
            insertMCPServerLog({
                serverId,
                serverName,
                type: 'disconnect',
                message: '連線已斷開'
            });
            if (!skipEvent) {
                this.emit('server:disconnected', { serverId, serverName, reason: 'manual' });
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error disconnecting MCP Server ${serverId}:`, error);
            insertMCPServerLog({
                serverId,
                serverName,
                type: 'error',
                message: `斷開連線時發生錯誤: ${errorMessage}`,
                details: JSON.stringify({ error: errorMessage })
            });
        }
        finally {
            this.clients.delete(serverId);
        }
    }
    async disconnectAll() {
        const serverIds = Array.from(this.clients.keys());
        await Promise.all(serverIds.map((id) => this.disconnect(id)));
    }
    scheduleReconnect(config, currentAttempt) {
        const delay = Math.min(this.reconnectConfig.baseDelay * Math.pow(2, currentAttempt), this.reconnectConfig.maxDelay);
        const nextRetryAt = new Date(Date.now() + delay).toISOString();
        const instance = this.clients.get(config.id);
        if (instance) {
            instance.state.status = 'reconnecting';
            instance.state.nextReconnectAt = nextRetryAt;
            instance.state.reconnectAttempts = currentAttempt + 1;
        }
        logger.info(`MCP Server ${config.name} 將在 ${delay}ms 後重連 (嘗試 ${currentAttempt + 1}/${this.reconnectConfig.maxAttempts})`);
        this.emit('server:reconnecting', {
            serverId: config.id,
            serverName: config.name,
            attempt: currentAttempt + 1,
            maxAttempts: this.reconnectConfig.maxAttempts,
            nextRetryIn: delay
        });
        const timer = setTimeout(async () => {
            logger.info(`正在重連 MCP Server: ${config.name}...`);
            await this.connect(config, true);
        }, delay);
        if (instance) {
            instance.reconnectTimer = timer;
        }
    }
    cancelReconnect(serverId) {
        const instance = this.clients.get(serverId);
        if (instance?.reconnectTimer) {
            clearTimeout(instance.reconnectTimer);
            instance.reconnectTimer = undefined;
            instance.state.status = 'error';
            instance.state.nextReconnectAt = undefined;
            logger.info(`取消 MCP Server ${serverId} 的重連`);
            this.emit('server:state-changed', { serverId, state: instance.state });
        }
    }
    async retryConnect(serverId) {
        const instance = this.clients.get(serverId);
        const config = instance?.config ?? getMCPServerById(serverId);
        if (!config) {
            logger.error(`無法找到 MCP Server 配置: ${serverId}`);
            return null;
        }
        if (instance?.reconnectTimer) {
            clearTimeout(instance.reconnectTimer);
        }
        if (instance) {
            instance.state.reconnectAttempts = 0;
        }
        return this.connect(config, false);
    }
    /**
     * 設置 transport 事件監聯器
     * 處理 MCP Server 運行時崩潰，將錯誤隔離不影響主程式
     */
    setupTransportHandlers(serverId, serverName, transport, instance) {
        transport.onerror = (error) => {
            logger.error(`MCP Server ${serverName} (ID: ${serverId}) transport 錯誤:`, error);
            instance.state.status = 'error';
            instance.state.error = error.message;
            instance.state.lastError = error.message;
            instance.state.lastErrorAt = new Date().toISOString();
            insertMCPServerLog({
                serverId,
                serverName,
                type: 'error',
                message: `Transport 錯誤: ${error.message}`,
                details: JSON.stringify({
                    error: error.message,
                    stack: error.stack
                })
            });
            this.emit('server:error', {
                serverId,
                serverName,
                error: error.message,
                details: error.stack
            });
            this.emit('server:state-changed', { serverId, state: instance.state });
        };
        transport.onclose = () => {
            const wasConnected = instance.state.status === 'connected';
            logger.info(`MCP Server ${serverName} (ID: ${serverId}) transport 已關閉`);
            if (wasConnected) {
                instance.state.status = 'error';
                instance.state.error = '連線意外斷開';
                instance.state.lastError = '連線意外斷開';
                instance.state.lastErrorAt = new Date().toISOString();
                insertMCPServerLog({
                    serverId,
                    serverName,
                    type: 'disconnect',
                    message: '連線意外斷開（Transport 關閉）'
                });
                this.emit('server:disconnected', { serverId, serverName, reason: 'unexpected' });
                this.emit('server:state-changed', { serverId, state: instance.state });
                if (this.reconnectConfig.enabled && instance.config) {
                    const currentAttempts = instance.state.reconnectAttempts ?? 0;
                    if (currentAttempts < this.reconnectConfig.maxAttempts) {
                        this.scheduleReconnect(instance.config, currentAttempts);
                    }
                    else {
                        logger.warn(`MCP Server ${serverName} 已達最大重連次數 (${this.reconnectConfig.maxAttempts})`);
                    }
                }
            }
        };
    }
    async createTransport(config) {
        switch (config.transport) {
            case 'stdio':
                if (!config.command) {
                    throw new Error('Command is required for stdio transport');
                }
                return new StdioClientTransport({
                    command: config.command,
                    args: config.args ?? [],
                    env: config.env ?? {},
                });
            case 'sse':
                if (!config.url) {
                    throw new Error('URL is required for SSE transport');
                }
                return new SSEClientTransport(new URL(config.url));
            case 'streamable-http':
                if (!config.url) {
                    throw new Error('URL is required for streamable-http transport');
                }
                const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
                return new StreamableHTTPClientTransport(new URL(config.url));
            default:
                throw new Error(`Unknown transport type: ${config.transport}`);
        }
    }
    async fetchTools(client) {
        try {
            const result = await client.listTools();
            return result.tools.map((tool) => ({
                name: tool.name,
                description: tool.description ?? '',
                inputSchema: (tool.inputSchema ?? {}),
            }));
        }
        catch {
            return [];
        }
    }
    async fetchResources(client) {
        try {
            const result = await client.listResources();
            return result.resources.map((resource) => ({
                uri: resource.uri,
                name: resource.name,
                description: resource.description ?? '',
                mimeType: resource.mimeType,
            }));
        }
        catch {
            return [];
        }
    }
    async fetchPrompts(client) {
        try {
            const result = await client.listPrompts();
            return result.prompts.map((prompt) => ({
                name: prompt.name,
                description: prompt.description ?? '',
                arguments: prompt.arguments?.map((arg) => ({
                    name: arg.name,
                    description: arg.description ?? '',
                    required: arg.required ?? false,
                })),
            }));
        }
        catch {
            return [];
        }
    }
    async refreshTools(serverId) {
        const instance = this.clients.get(serverId);
        if (!instance || instance.state.status !== 'connected') {
            return [];
        }
        const tools = await this.fetchTools(instance.client);
        instance.state.tools = tools;
        return tools;
    }
    getState(serverId) {
        const instance = this.clients.get(serverId);
        return instance?.state ?? null;
    }
    getAllStates() {
        return Array.from(this.clients.values()).map((instance) => instance.state);
    }
    isConnected(serverId) {
        const instance = this.clients.get(serverId);
        return instance?.state.status === 'connected';
    }
    getAllTools(filterEnabled = true) {
        const tools = [];
        for (const [serverId, instance] of this.clients.entries()) {
            if (instance.state.status === 'connected') {
                const enableConfigs = filterEnabled ? getToolEnableConfigs(serverId) : new Map();
                const toolsWithServerId = instance.state.tools
                    .filter(tool => !filterEnabled || enableConfigs.get(tool.name) !== false)
                    .map(tool => ({
                    ...tool,
                    serverId,
                    enabled: filterEnabled ? enableConfigs.get(tool.name) !== false : true
                }));
                tools.push(...toolsWithServerId);
            }
        }
        return tools;
    }
    getServerTools(serverId, includeDisabled = false) {
        const instance = this.clients.get(serverId);
        if (!instance || instance.state.status !== 'connected') {
            return [];
        }
        const enableConfigs = getToolEnableConfigs(serverId);
        return instance.state.tools.map(tool => ({
            ...tool,
            serverId,
            enabled: enableConfigs.get(tool.name) !== false
        })).filter(tool => includeDisabled || tool.enabled);
    }
    async callTool(serverId, toolName, args, bypassEnableCheck = false) {
        const instance = this.clients.get(serverId);
        if (!instance) {
            logger.error(`MCP Server not found: ${serverId}`);
            return {
                success: false,
                error: `MCP Server not found: ${serverId}`,
            };
        }
        if (instance.state.status !== 'connected') {
            logger.error(`MCP Server not connected: ${serverId}`);
            return {
                success: false,
                error: `MCP Server not connected: ${serverId}`,
            };
        }
        if (!bypassEnableCheck && !isToolEnabled(serverId, toolName)) {
            logger.warn(`Tool ${toolName} is disabled on server ${serverId}`);
            return {
                success: false,
                error: `Tool ${toolName} is disabled`,
            };
        }
        try {
            const result = await instance.client.callTool({
                name: toolName,
                arguments: args ?? {},
            });
            const content = result.content.map((item) => {
                if (item.type === 'text') {
                    return { type: 'text', text: item.text ?? '' };
                }
                else if (item.type === 'image') {
                    return {
                        type: 'image',
                        data: item.data ?? '',
                        mimeType: item.mimeType ?? 'image/png',
                    };
                }
                return { type: 'text', text: JSON.stringify(item) };
            });
            return {
                success: !result.isError,
                content,
                error: result.isError ? 'Tool execution failed' : undefined,
            };
        }
        catch (error) {
            logger.error(`Error calling tool ${toolName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async readResource(serverId, uri) {
        const instance = this.clients.get(serverId);
        if (!instance || instance.state.status !== 'connected') {
            return null;
        }
        try {
            const result = await instance.client.readResource({ uri });
            const firstContent = result.contents[0];
            if (firstContent && 'text' in firstContent && typeof firstContent.text === 'string') {
                return firstContent.text;
            }
            return null;
        }
        catch (error) {
            logger.error(`Error reading resource ${uri}:`, error);
            return null;
        }
    }
    async getPrompt(serverId, name, args) {
        const instance = this.clients.get(serverId);
        if (!instance || instance.state.status !== 'connected') {
            return null;
        }
        try {
            const result = await instance.client.getPrompt({ name, arguments: args });
            const messages = result.messages.map((msg) => {
                if (typeof msg.content === 'string') {
                    return msg.content;
                }
                if (msg.content && typeof msg.content === 'object' && 'text' in msg.content) {
                    return msg.content.text;
                }
                return '';
            });
            return messages.join('\n');
        }
        catch (error) {
            logger.error(`Error getting prompt ${name}:`, error);
            return null;
        }
    }
    findServerWithTool(toolName) {
        for (const [serverId, instance] of this.clients) {
            if (instance.state.status === 'connected') {
                const hasTool = instance.state.tools.some((t) => t.name === toolName);
                if (hasTool)
                    return serverId;
            }
        }
        return null;
    }
}
export const mcpClientManager = MCPClientManager.getInstance();
//# sourceMappingURL=mcp-client-manager.js.map