/**
 * MCP Client Manager
 * 管理與 MCP Server 的連接
 */
import { EventEmitter } from 'events';
import { MCPServerConfig, MCPServerState, MCPToolInfo, MCPToolCallResult } from '../types/index.js';
interface ReconnectConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    enabled: boolean;
}
export interface MCPClientEvents {
    'server:connected': {
        serverId: number;
        serverName: string;
        state: MCPServerState;
    };
    'server:disconnected': {
        serverId: number;
        serverName: string;
        reason: string;
    };
    'server:error': {
        serverId: number;
        serverName: string;
        error: string;
        details?: string;
    };
    'server:reconnecting': {
        serverId: number;
        serverName: string;
        attempt: number;
        maxAttempts: number;
        nextRetryIn: number;
    };
    'server:state-changed': {
        serverId: number;
        state: MCPServerState;
    };
}
declare class MCPClientManager extends EventEmitter {
    private static instance;
    private clients;
    private reconnectConfig;
    private constructor();
    static getInstance(): MCPClientManager;
    setReconnectConfig(config: Partial<ReconnectConfig>): void;
    getReconnectConfig(): ReconnectConfig;
    connect(config: MCPServerConfig, isReconnect?: boolean): Promise<MCPServerState>;
    disconnect(serverId: number, skipEvent?: boolean): Promise<void>;
    disconnectAll(): Promise<void>;
    private scheduleReconnect;
    cancelReconnect(serverId: number): void;
    retryConnect(serverId: number): Promise<MCPServerState | null>;
    /**
     * 設置 transport 事件監聯器
     * 處理 MCP Server 運行時崩潰，將錯誤隔離不影響主程式
     */
    private setupTransportHandlers;
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