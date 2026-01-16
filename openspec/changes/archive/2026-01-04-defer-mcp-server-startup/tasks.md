# Tasks: Defer MCP Server Startup

## Phase 1: Database & Types (Day 1)

### Task 1.1: Update Database Schema
- [x] Add `deferred_startup` column to `mcp_servers` table (INTEGER, default 0)
- [x] Add `startup_args_template` column to `mcp_servers` table (TEXT, nullable)
- [x] Create migration or update `initDatabase()` to add columns if missing
- [x] **Validation**: Run `npm run build` and verify no errors

### Task 1.2: Update Type Definitions
- [x] Add `deferredStartup?: boolean` to `MCPServerConfig` interface
- [x] Add `startupArgsTemplate?: string[]` to `MCPServerConfig` interface
- [x] Add `DeferredStartupContext` interface with `projectName` and `projectPath`
- [x] **Validation**: Run `npm run build` and verify no type errors

### Task 1.3: Add Database Functions
- [x] Add `getDeferredMCPServers()` function
- [x] Add `getEnabledNonDeferredMCPServers()` function
- [x] Update `createMCPServer()` to handle new fields
- [x] Update `updateMCPServer()` to handle new fields
- [x] **Validation**: Write unit test for new database functions

## Phase 2: Backend Logic (Day 1)

### Task 2.1: Update MCPClientManager
- [x] Add `deferredServersStarted` private flag
- [x] Add `startDeferredServers(context: DeferredStartupContext)` method
- [x] Add `resolveArgsTemplate()` private method for placeholder substitution
- [x] Add `resetDeferredState()` method for testing
- [x] **Validation**: Unit test for `resolveArgsTemplate()` with various inputs

### Task 2.2: Update WebServer autoStartMCPServers
- [x] Filter out servers with `deferredStartup=true` in `autoStartMCPServers()`
- [x] Log count of deferred vs immediate servers
- [x] **Validation**: Manual test - deferred servers should not start at boot

### Task 2.3: Update MCP Server collect_feedback
- [x] Add `deferredStartupTriggered` private flag
- [x] Import `mcpClientManager` in mcp-server.ts
- [x] Add logic to call `startDeferredServers()` on first report with project_path
- [x] **Validation**: Integration test - first report should trigger deferred startup

## Phase 3: Frontend UI (Day 2)

### Task 3.1: Update MCP Settings Page
- [x] Add "Deferred Startup" toggle checkbox for each server
- [x] Add "Startup Args Template" text input (shown when deferred is enabled)
- [x] Add help text explaining placeholders `{project_path}`, `{project_name}`
- [x] **Validation**: UI renders correctly, toggle saves to database

### Task 3.2: Update MCP Server Status Display
- [x] Show "Waiting for project info" status for deferred servers at boot
- [x] Update status to "Connected" after startup is triggered
- [x] **Validation**: Status updates correctly in real-time via Socket.IO

## Phase 4: API Endpoints (Day 2)

### Task 4.1: Update MCP Server API
- [x] Update `POST /api/mcp-servers` to accept `deferredStartup` and `startupArgsTemplate`
- [x] Update `PUT /api/mcp-servers/:id` to accept new fields
- [x] Update `GET /api/mcp-servers` to return new fields
- [x] **Validation**: API returns and accepts new fields correctly

## Phase 5: Testing & Documentation (Day 2)

### Task 5.1: Unit Tests
- [x] Test `resolveArgsTemplate()` with `{project_path}` placeholder
- [x] Test `resolveArgsTemplate()` with `{project_name}` placeholder
- [x] Test `resolveArgsTemplate()` with both placeholders
- [x] Test `resolveArgsTemplate()` with no placeholders
- [x] Test `getDeferredMCPServers()` database function
- [x] **Validation**: All tests pass with `npm test`

### Task 5.2: Integration Tests
- [x] Test deferred servers not started at boot
- [x] Test deferred servers start on first `collect_feedback` with project_path
- [x] Test placeholder substitution in real server startup
- [x] Test fallback when no project_path provided
- [x] **Validation**: Integration tests pass

### Task 5.3: E2E Browser Tests
- [x] Test MCP Settings UI toggle
- [x] Test server status display updates
- [x] **Validation**: Browser tests pass

### Task 5.4: Documentation
- [x] Update README with deferred startup feature
- [x] Add example configuration for Serena with deferred startup
- [x] **Validation**: Documentation is clear and accurate

## Dependencies

- Task 1.1 → Task 1.3 (database schema needed for functions)
- Task 1.2 → Task 2.1, 2.3 (types needed for implementation)
- Task 2.1 → Task 2.2, 2.3 (MCPClientManager methods needed)
- Phase 1, 2 → Phase 3, 4 (backend needed for frontend)
- Phase 1-4 → Phase 5 (implementation needed for testing)

## Parallelizable Work

- Task 1.1 and 1.2 can be done in parallel
- Task 3.1 and 3.2 can be done in parallel
- Task 5.1 and 5.2 can be done in parallel after Phase 1-2
