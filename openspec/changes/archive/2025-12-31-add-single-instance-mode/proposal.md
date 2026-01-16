# Proposal: Add Single Instance Mode for User Feedback

## Overview

This proposal adds a Single Instance Mode mechanism to ensure that only one User Feedback MCP server instance runs at any time, preventing resource waste and port conflicts when the tool is invoked multiple times.

## Motivation

Current limitations:
- Every invocation of `user-web-feedback` creates a new `MCPServer` instance
- Each instance attempts to start its own `WebServer`, potentially causing port conflicts
- Multiple instances waste system resources (memory, CPU, network ports)
- No coordination between concurrent invocations

Benefits of Single Instance Mode:
- **Resource efficiency**: Only one server process consumes system resources
- **Port stability**: Fixed port without conflicts
- **Simplified debugging**: Single log stream, single process to monitor
- **Better UX**: Consistent endpoint for all AI clients

## Goals

- **Lock file mechanism**: Use system lock file to track running instance
- **Health check**: HTTP endpoint to verify existing instance is alive
- **Automatic cleanup**: Remove stale locks from crashed instances
- **Port reuse**: Connect to existing instance instead of creating new one
- **Multi-client support**: Allow multiple AI clients to connect to same instance

## Non-Goals

- Clustering or distributed deployment
- Load balancing between instances
- Hot reload / live restart of running instance
- Version mismatch handling between clients

## Affected Components

### New Files
- `src/utils/instance-lock.ts` - Lock file management and instance detection

### Modified Files
- `src/cli.ts` - Add instance check before server start
- `src/server/web-server.ts` - Add health check endpoint, lock file integration
- `src/config/index.ts` - Add lock file path configuration

### Database
- No database changes required

## Technical Approach

### 1. Lock File Structure
```json
{
  "pid": 12345,
  "port": 5000,
  "startTime": "2026-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

Location: `data/.user-feedback.lock` (default)

### 2. Instance Detection Flow
1. On startup, check if lock file exists
2. If exists, read PID and port from lock file
3. HTTP GET to `http://localhost:{port}/api/health`
4. If response OK → return existing port (don't start new server)
5. If no response → clean up stale lock, proceed to start new server
6. On successful start → write new lock file

### 3. Health Check Endpoint
- Path: `/api/health`
- Response: `{ "status": "ok", "pid": number, "port": number, "uptime": number }`

### 4. Graceful Shutdown
- On SIGINT/SIGTERM → remove lock file before exit
- On crash → stale lock detected via health check failure

## Dependencies

- Node.js `fs` module for lock file operations
- Existing `PortManager` for port availability checks

## Success Criteria

1. First invocation starts server and creates lock file
2. Subsequent invocations detect running instance and reuse it
3. After crash, next invocation cleans stale lock and starts fresh
4. Multiple AI clients can connect to same instance
5. All existing tests pass
6. New unit tests for instance lock module

## Timeline

Estimated: 1 day

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Lock file permission issues | Use user-writable data directory |
| Stale lock after hard kill | Health check detects and cleans up |
| Race condition on startup | Atomic lock file operations |
| Port mismatch after restart | Always verify via health check |
