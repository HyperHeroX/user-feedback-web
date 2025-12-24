/**
 * MCP Client Manager
 * 管理與 MCP Server 的連接
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
    MCPServerConfig,
    MCPServerState,
    MCPToolInfo,
    MCPResourceInfo,
    MCPPromptInfo,
    MCPToolCallResult,
} from '../types/index.js';
import { logger } from './logger.js';
import { getToolEnableConfigs, isToolEnabled, insertMCPServerLog } from './database.js';

interface MCPClientInstance {
    client: Client;
    transport: Transport;
    state: MCPServerState;
}

interface MCPContent {
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
}

class MCPClientManager {
    private static instance: MCPClientManager;
    private clients: Map<number, MCPClientInstance> = new Map();

    private constructor() { }

    static getInstance(): MCPClientManager {
        if (!MCPClientManager.instance) {
            MCPClientManager.instance = new MCPClientManager();
        }
        return MCPClientManager.instance;
    }

    async connect(config: MCPServerConfig): Promise<MCPServerState> {
        if (this.clients.has(config.id)) {
            const existing = this.clients.get(config.id)!;
            if (existing.state.status === 'connected') {
                return existing.state;
            }
            await this.disconnect(config.id);
        }

        const state: MCPServerState = {
            id: config.id,
            status: 'connecting',
            tools: [],
            resources: [],
            prompts: [],
        };

        try {
            const transport = await this.createTransport(config);
            const client = new Client(
                { name: 'user-feedback-mcp-client', version: '1.0.0' },
                { capabilities: {} }
            );

            await client.connect(transport);

            const instance: MCPClientInstance = { client, transport, state };

            instance.state.status = 'connected';
            instance.state.connectedAt = new Date().toISOString();

            instance.state.tools = await this.fetchTools(client);
            instance.state.resources = await this.fetchResources(client);
            instance.state.prompts = await this.fetchPrompts(client);

            this.clients.set(config.id, instance);
            logger.info(`MCP Server connected: ${config.name} (ID: ${config.id})`);

            insertMCPServerLog({
                serverId: config.id,
                serverName: config.name,
                type: 'connect',
                message: `連線成功，工具數量: ${instance.state.tools.length}`,
                details: JSON.stringify({
                    toolCount: instance.state.tools.length,
                    resourceCount: instance.state.resources.length,
                    promptCount: instance.state.prompts.length
                })
            });

            return instance.state;
        } catch (error) {
            state.status = 'error';
            const errorMessage = error instanceof Error ? error.message : String(error);
            state.error = errorMessage;
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
                    stack: error instanceof Error ? error.stack : undefined
                })
            });

            return state;
        }
    }

    async disconnect(serverId: number): Promise<void> {
        const instance = this.clients.get(serverId);
        if (!instance) return;

        const serverName = instance.state.id ? `Server ${instance.state.id}` : 'Unknown';

        try {
            await instance.client.close();
            logger.info(`MCP Server disconnected: ID ${serverId}`);

            insertMCPServerLog({
                serverId,
                serverName,
                type: 'disconnect',
                message: '連線已斷開'
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error disconnecting MCP Server ${serverId}:`, error);

            insertMCPServerLog({
                serverId,
                serverName,
                type: 'error',
                message: `斷開連線時發生錯誤: ${errorMessage}`,
                details: JSON.stringify({ error: errorMessage })
            });
        } finally {
            this.clients.delete(serverId);
        }
    }

    async disconnectAll(): Promise<void> {
        const serverIds = Array.from(this.clients.keys());
        await Promise.all(serverIds.map((id) => this.disconnect(id)));
    }

    private async createTransport(config: MCPServerConfig): Promise<Transport> {
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
                const { StreamableHTTPClientTransport } = await import(
                    '@modelcontextprotocol/sdk/client/streamableHttp.js'
                );
                return new StreamableHTTPClientTransport(new URL(config.url)) as unknown as Transport;

            default:
                throw new Error(`Unknown transport type: ${config.transport}`);
        }
    }

    private async fetchTools(client: Client): Promise<MCPToolInfo[]> {
        try {
            const result = await client.listTools();
            return result.tools.map((tool) => ({
                name: tool.name,
                description: tool.description ?? '',
                inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
            }));
        } catch {
            return [];
        }
    }

    private async fetchResources(client: Client): Promise<MCPResourceInfo[]> {
        try {
            const result = await client.listResources();
            return result.resources.map((resource) => ({
                uri: resource.uri,
                name: resource.name,
                description: resource.description ?? '',
                mimeType: resource.mimeType,
            }));
        } catch {
            return [];
        }
    }

    private async fetchPrompts(client: Client): Promise<MCPPromptInfo[]> {
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
        } catch {
            return [];
        }
    }

    async refreshTools(serverId: number): Promise<MCPToolInfo[]> {
        const instance = this.clients.get(serverId);
        if (!instance || instance.state.status !== 'connected') {
            return [];
        }

        const tools = await this.fetchTools(instance.client);
        instance.state.tools = tools;
        return tools;
    }

    getState(serverId: number): MCPServerState | null {
        const instance = this.clients.get(serverId);
        return instance?.state ?? null;
    }

    getAllStates(): MCPServerState[] {
        return Array.from(this.clients.values()).map((instance) => instance.state);
    }

    isConnected(serverId: number): boolean {
        const instance = this.clients.get(serverId);
        return instance?.state.status === 'connected';
    }

    getAllTools(filterEnabled = true): MCPToolInfo[] {
        const tools: MCPToolInfo[] = [];
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

    getServerTools(serverId: number, includeDisabled = false): MCPToolInfo[] {
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

    async callTool(
        serverId: number,
        toolName: string,
        args?: Record<string, unknown>,
        bypassEnableCheck = false
    ): Promise<MCPToolCallResult> {
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

            const content = (result.content as MCPContent[]).map((item: MCPContent) => {
                if (item.type === 'text') {
                    return { type: 'text' as const, text: item.text ?? '' };
                } else if (item.type === 'image') {
                    return {
                        type: 'image' as const,
                        data: item.data ?? '',
                        mimeType: item.mimeType ?? 'image/png',
                    };
                }
                return { type: 'text' as const, text: JSON.stringify(item) };
            });

            return {
                success: !result.isError,
                content,
                error: result.isError ? 'Tool execution failed' : undefined,
            };
        } catch (error) {
            logger.error(`Error calling tool ${toolName}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async readResource(serverId: number, uri: string): Promise<string | null> {
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
        } catch (error) {
            logger.error(`Error reading resource ${uri}:`, error);
            return null;
        }
    }

    async getPrompt(
        serverId: number,
        name: string,
        args?: Record<string, string>
    ): Promise<string | null> {
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
                    return (msg.content as { text: string }).text;
                }
                return '';
            });
            return messages.join('\n');
        } catch (error) {
            logger.error(`Error getting prompt ${name}:`, error);
            return null;
        }
    }

    findServerWithTool(toolName: string): number | null {
        for (const [serverId, instance] of this.clients) {
            if (instance.state.status === 'connected') {
                const hasTool = instance.state.tools.some((t) => t.name === toolName);
                if (hasTool) return serverId;
            }
        }
        return null;
    }
}

export const mcpClientManager = MCPClientManager.getInstance();
