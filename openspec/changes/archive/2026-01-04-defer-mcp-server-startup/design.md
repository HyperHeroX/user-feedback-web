# Design: Defer MCP Server Startup

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        System Startup                           │
├─────────────────────────────────────────────────────────────────┤
│  1. WebServer.start()                                           │
│     └── Skip autoStartMCPServers() for deferred servers         │
│                                                                 │
│  2. MCPServer registers collect_feedback tool                   │
│     └── First call with project_path triggers startup           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AI Reports (collect_feedback)                 │
├─────────────────────────────────────────────────────────────────┤
│  Input: { work_summary, project_name?, project_path? }          │
│                                                                 │
│  if (project_path && !deferredServersStarted) {                 │
│      startDeferredMCPServers(project_name, project_path)        │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MCPClientManager.startDeferred()               │
├─────────────────────────────────────────────────────────────────┤
│  1. Get all servers with deferredStartup=true                   │
│  2. For each server:                                            │
│     - Substitute {project_path} in args                         │
│     - Substitute {project_name} in args                         │
│     - Call connect(config)                                      │
│  3. Mark deferredServersStarted = true                          │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Database Schema Changes

```sql
-- Add columns to mcp_servers table
ALTER TABLE mcp_servers ADD COLUMN deferred_startup INTEGER DEFAULT 0;
ALTER TABLE mcp_servers ADD COLUMN startup_args_template TEXT;
```

The `startup_args_template` stores the original args with placeholders, while `args` stores the resolved args after substitution.

### 2. Type Definitions

```typescript
// src/types/index.ts

export interface MCPServerConfig {
  // ... existing fields ...
  deferredStartup?: boolean;        // Whether to defer startup until project info is available
  startupArgsTemplate?: string[];   // Args template with {project_path}, {project_name} placeholders
}

export interface DeferredStartupContext {
  projectName: string;
  projectPath: string;
}
```

### 3. MCPClientManager Changes

```typescript
// src/utils/mcp-client-manager.ts

class MCPClientManager extends EventEmitter {
    private deferredServersStarted = false;
    
    /**
     * Start all MCP Servers configured for deferred startup
     */
    async startDeferredServers(context: DeferredStartupContext): Promise<void> {
        if (this.deferredServersStarted) {
            logger.debug('Deferred servers already started, skipping');
            return;
        }
        
        const deferredServers = getDeferredMCPServers();
        
        for (const config of deferredServers) {
            const resolvedConfig = this.resolveArgsTemplate(config, context);
            await this.connect(resolvedConfig);
        }
        
        this.deferredServersStarted = true;
    }
    
    /**
     * Replace placeholders in args with actual values
     */
    private resolveArgsTemplate(
        config: MCPServerConfig, 
        context: DeferredStartupContext
    ): MCPServerConfig {
        const args = (config.startupArgsTemplate || config.args).map(arg => 
            arg.replace('{project_path}', context.projectPath)
               .replace('{project_name}', context.projectName)
        );
        return { ...config, args };
    }
    
    /**
     * Reset deferred startup state (for testing or restart)
     */
    resetDeferredState(): void {
        this.deferredServersStarted = false;
    }
}
```

### 4. WebServer Changes

```typescript
// src/server/web-server.ts

private async autoStartMCPServers(): Promise<void> {
    try {
        // Get only non-deferred enabled servers
        const enabledServers = getEnabledMCPServers().filter(s => !s.deferredStartup);
        
        if (enabledServers.length === 0) {
            logger.info('沒有需要立即啟動的 MCP Servers');
            return;
        }
        
        // ... rest of existing logic for non-deferred servers ...
    } catch (error) {
        logger.error('MCP Server 自動啟動過程中發生錯誤:', error);
    }
}
```

### 5. MCP Server Changes

```typescript
// src/server/mcp-server.ts

export class MCPServer {
    private deferredStartupTriggered = false;
    
    private async collectFeedback(params: CollectFeedbackParams): Promise<...> {
        const { work_summary, project_name, project_path } = params;
        
        // Trigger deferred MCP server startup on first report with project info
        if (project_path && !this.deferredStartupTriggered) {
            this.deferredStartupTriggered = true;
            
            logger.info(`首次收到專案資訊，啟動延遲的 MCP Servers: ${project_name || 'Unknown'} @ ${project_path}`);
            
            await mcpClientManager.startDeferredServers({
                projectName: project_name || path.basename(project_path),
                projectPath: project_path
            });
        }
        
        // ... rest of existing logic ...
    }
}
```

### 6. Database Functions

```typescript
// src/utils/database.ts

export function getDeferredMCPServers(): MCPServerConfig[] {
    const stmt = db.prepare(`
        SELECT * FROM mcp_servers 
        WHERE enabled = 1 AND deferred_startup = 1
        ORDER BY id
    `);
    return stmt.all() as MCPServerConfig[];
}

export function getEnabledNonDeferredMCPServers(): MCPServerConfig[] {
    const stmt = db.prepare(`
        SELECT * FROM mcp_servers 
        WHERE enabled = 1 AND (deferred_startup = 0 OR deferred_startup IS NULL)
        ORDER BY id
    `);
    return stmt.all() as MCPServerConfig[];
}
```

## UI Design

### MCP Settings Page

Add a toggle switch for each MCP Server:

```
┌─────────────────────────────────────────────────────────────┐
│ Serena MCP Server                                    [Edit] │
├─────────────────────────────────────────────────────────────┤
│ Command: uvx                                                │
│ Args: --from git+https://github.com/oraios/serena ...       │
│                                                             │
│ [✓] Enabled                                                 │
│ [✓] Deferred Startup (等待 AI 回報專案資訊後啟動)            │
│                                                             │
│ Startup Arguments Template:                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ {project_path}                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ 可用變數: {project_path}, {project_name}                    │
└─────────────────────────────────────────────────────────────┘
```

## Sequence Diagram

```
User          WebServer      MCPServer     MCPClientManager    Serena
  │               │              │               │               │
  │  Start System │              │               │               │
  │───────────────>│             │               │               │
  │               │ autoStart() │               │               │
  │               │──────────────────────────────>│               │
  │               │ (skip deferred servers)      │               │
  │               │              │               │               │
  │               │              │               │               │
  │  AI: collect_feedback(project_path="/my/proj")              │
  │────────────────────────────────>│            │               │
  │               │              │  startDeferred({projectPath}) │
  │               │              │───────────────>│               │
  │               │              │               │  connect()    │
  │               │              │               │───────────────>│
  │               │              │               │  (with /my/proj)
  │               │              │               │<──────────────│
  │               │              │<──────────────│               │
  │<────────────────────────────────│            │               │
  │  feedback response              │            │               │
```

## Error Handling

1. **No project info provided**: Log warning, do not start deferred servers
2. **Server startup failure**: Log error, emit event for dashboard notification, continue with other servers
3. **Invalid project path**: Log error, skip that server
4. **Timeout**: No timeout for deferred startup; servers start when info is available

## Testing Strategy

1. **Unit tests**: Test `resolveArgsTemplate()` with various placeholder combinations
2. **Integration tests**: Test full flow from `collect_feedback` to server startup
3. **Database tests**: Test new columns and queries
4. **UI tests**: Test toggle switch and template input
