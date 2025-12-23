/**
 * MCP Client Manager
 * 管理與 MCP Server 的連接
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { logger } from './logger.js';
class MCPClientManager {
    static instance;
    clients = new Map();
    constructor() { }
    static getInstance() {
        if (!MCPClientManager.instance) {
            MCPClientManager.instance = new MCPClientManager();
        }
        return MCPClientManager.instance;
    }
    async connect(config) {
        if (this.clients.has(config.id)) {
            const existing = this.clients.get(config.id);
            if (existing.state.status === 'connected') {
                return existing.state;
            }
            await this.disconnect(config.id);
        }
        const state = {
            id: config.id,
            status: 'connecting',
            tools: [],
            resources: [],
            prompts: [],
        };
        try {
            const transport = await this.createTransport(config);
            const client = new Client({ name: 'user-feedback-mcp-client', version: '1.0.0' }, { capabilities: {} });
            await client.connect(transport);
            const instance = { client, transport, state };
            instance.state.status = 'connected';
            instance.state.connectedAt = new Date().toISOString();
            instance.state.tools = await this.fetchTools(client);
            instance.state.resources = await this.fetchResources(client);
            instance.state.prompts = await this.fetchPrompts(client);
            this.clients.set(config.id, instance);
            logger.info(`MCP Server connected: ${config.name} (ID: ${config.id})`);
            return instance.state;
        }
        catch (error) {
            state.status = 'error';
            state.error = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to connect MCP Server ${config.name}:`, error);
            return state;
        }
    }
    async disconnect(serverId) {
        const instance = this.clients.get(serverId);
        if (!instance)
            return;
        try {
            await instance.client.close();
            logger.info(`MCP Server disconnected: ID ${serverId}`);
        }
        catch (error) {
            logger.error(`Error disconnecting MCP Server ${serverId}:`, error);
        }
        finally {
            this.clients.delete(serverId);
        }
    }
    async disconnectAll() {
        const serverIds = Array.from(this.clients.keys());
        await Promise.all(serverIds.map((id) => this.disconnect(id)));
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
    getAllTools() {
        const tools = [];
        for (const [serverId, instance] of this.clients.entries()) {
            if (instance.state.status === 'connected') {
                const toolsWithServerId = instance.state.tools.map(tool => ({
                    ...tool,
                    serverId
                }));
                tools.push(...toolsWithServerId);
            }
        }
        return tools;
    }
    async callTool(serverId, toolName, args) {
        const instance = this.clients.get(serverId);
        if (!instance) {
            return {
                success: false,
                error: `MCP Server not found: ${serverId}`,
            };
        }
        if (instance.state.status !== 'connected') {
            return {
                success: false,
                error: `MCP Server not connected: ${serverId}`,
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