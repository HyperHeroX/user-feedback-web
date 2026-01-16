# Proposal: Defer MCP Server Startup

## Why

Current limitations:
- MCP Servers (e.g., Serena) start immediately at system boot without project context
- Serena auto-detects project root from `cwd` or user home, which may cause permission errors (e.g., `C:\Users\Hiro\Application Data`)
- No way to pass project-specific parameters to MCP Servers at startup
- MCP Servers may fail to initialize properly without knowing the target project

Benefits of deferred startup:
- **Project-aware startup**: MCP Servers receive correct project context from AI's first report
- **Avoid permission errors**: Serena starts with the actual project path instead of user home
- **Dynamic configuration**: MCP Server arguments can include project name/path from runtime context
- **Better initialization**: External tools like Serena can activate the correct project automatically

## What Changes

This proposal modifies the system startup behavior to defer MCP Server connections until the AI provides project information through its first report. Instead of auto-starting all enabled MCP Servers at system boot, the system will wait for the AI to call `collect_feedback` with `project_name` and `project_path`, then start the configured MCP Servers with the project context.

### Goals

- **Deferred MCP startup**: Do not auto-start MCP Servers in `autoStartMCPServers()` at boot
- **Startup trigger**: Start MCP Servers when AI sends first `collect_feedback` with project info
- **Dynamic arguments**: Support injecting `project_path` into MCP Server command arguments (e.g., `serena start-mcp-server --project {project_path}`)
- **Configuration option**: Add per-server setting to enable/disable deferred startup
- **Fallback behavior**: If no project info provided, use existing startup behavior

### Non-Goals

- Changing the MCP Server configuration storage schema significantly
- Supporting multiple simultaneous project contexts
- Modifying the Serena MCP Server itself
- Real-time project switching after servers are started

## Affected Components

### Backend (TypeScript)
- `src/server/web-server.ts` - Remove or modify `autoStartMCPServers()` call
- `src/server/mcp-server.ts` - Add logic to trigger MCP startup on first report
- `src/utils/mcp-client-manager.ts` - Add method to start servers with project context
- `src/types/index.ts` - Add types for deferred startup configuration
- `src/utils/database.ts` - Add deferred startup flag to MCP server config

### Frontend (HTML/JS/CSS)
- `src/static/mcp-settings.html` - Add "Deferred Startup" toggle per server
- `src/static/mcp-settings.js` - Handle deferred startup setting
- `src/static/dashboard.html` - Show MCP Server startup status

### Database
- Table: `mcp_servers` - Add column `deferred_startup` (boolean, default: false)
- Table: `mcp_servers` - Add column `startup_args_template` (string, for `{project_path}` substitution)

## Implementation Details

### Argument Template Substitution

MCP Server configurations can include placeholders in their arguments:
- `{project_path}` - Replaced with the project path from AI report
- `{project_name}` - Replaced with the project name from AI report

Example configuration for Serena:
```json
{
  "name": "serena",
  "command": "uvx",
  "args": ["--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server", "--context", "desktop-app", "{project_path}"],
  "deferredStartup": true
}
```

### Startup Flow

1. System boots → Web server starts → MCP Servers with `deferredStartup=true` are **not** started
2. AI calls `collect_feedback({ work_summary: "...", project_name: "my-project", project_path: "/path/to/project" })`
3. System detects this is the first report with project info
4. System starts all deferred MCP Servers, substituting `{project_path}` and `{project_name}` in args
5. Subsequent reports do not trigger re-startup

## Dependencies

- Existing `mcpClientManager` infrastructure
- Existing database schema for MCP server configurations

## Success Criteria

1. MCP Servers with `deferredStartup=true` do not start at system boot
2. First AI report with project info triggers deferred server startup
3. `{project_path}` and `{project_name}` are correctly substituted in server args
4. Serena MCP Server receives correct project path and initializes without permission errors
5. MCP Settings page shows deferred startup toggle
6. Existing tests continue to pass
7. New tests cover deferred startup scenarios

## Timeline

Estimated: 1-2 days

## Related Changes

- None (standalone feature)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| AI never provides project info | Fallback: start servers with default args after timeout or user action |
| Multiple projects in one session | First project wins; restart requires system restart or manual UI action |
| Server startup failure | Log error, notify via dashboard, allow manual retry |
