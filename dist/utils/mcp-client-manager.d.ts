/**
 * MCP Client Manager
 * 管理與 MCP Server 的連接
 */
import { MCPServerConfig, MCPServerState, MCPToolInfo, MCPToolCallResult } from '../types/index.js';
declare class MCPClientManager {
    private static instance;
    private clients;
    private constructor();
    static getInstance(): MCPClientManager;
    connect(config: MCPServerConfig): Promise<MCPServerState>;
    disconnect(serverId: number): Promise<void>;
    disconnectAll(): Promise<void>;
    private createTransport;
    private fetchTools;
    private fetchResources;
    private fetchPrompts;
    refreshTools(serverId: number): Promise<MCPToolInfo[]>;
    getState(serverId: number): MCPServerState | null;
    getAllStates(): MCPServerState[];
    isConnected(serverId: number): boolean;
    getAllTools(filterEnabled?: boolean): MCPToolInfo[];
    getServerTools(serverId: number, includeDisabled?: boolean): MCPToolInfo[];
    callTool(serverId: number, toolName: string, args?: Record<string, unknown>, bypassEnableCheck?: boolean): Promise<MCPToolCallResult>;
    readResource(serverId: number, uri: string): Promise<string | null>;
    getPrompt(serverId: number, name: string, args?: Record<string, string>): Promise<string | null>;
    findServerWithTool(toolName: string): number | null;
}
export declare const mcpClientManager: MCPClientManager;
export {};
//# sourceMappingURL=mcp-client-manager.d.ts.map