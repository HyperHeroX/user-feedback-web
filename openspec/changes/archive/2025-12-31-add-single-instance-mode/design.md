# Design: Single Instance Mode Architecture

## Overview

This document describes the technical design for implementing Single Instance Mode in User Feedback, ensuring only one MCP server instance runs at any time.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLI Invocation Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐    ┌──────────────────┐    ┌─────────────────────┐   │
│  │ AI Client│───▶│ user-web-feedback│───▶│ InstanceLock.check()│   │
│  │ (Cursor, │    │     CLI          │    │                     │   │
│  │  VS Code)│    └──────────────────┘    └──────────┬──────────┘   │
│  └──────────┘                                       │              │
│                                                     ▼              │
│                            ┌────────────────────────────────────┐  │
│                            │     Lock File Exists?              │  │
│                            └──────────────┬─────────────────────┘  │
│                                           │                        │
│              ┌────────────────────────────┴──────────────────────┐ │
│              │ YES                                           NO  │ │
│              ▼                                                ▼  │ │
│  ┌───────────────────────┐                    ┌────────────────┐ │ │
│  │ HTTP Health Check     │                    │ Start New      │ │ │
│  │ GET /api/health       │                    │ MCPServer      │ │ │
│  └───────────┬───────────┘                    └───────┬────────┘ │ │
│              │                                        │          │ │
│    ┌─────────┴─────────┐                              │          │ │
│    │ OK            FAIL│                              │          │ │
│    ▼                   ▼                              ▼          │ │
│  ┌──────────┐   ┌────────────┐              ┌────────────────┐   │ │
│  │ Return   │   │ Clean Lock │              │ Write Lock     │   │ │
│  │ Existing │   │ Start New  │              │ File           │   │ │
│  │ Port     │   │ Server     │              │                │   │ │
│  └──────────┘   └────────────┘              └────────────────┘   │ │
│                                                                   │ │
└───────────────────────────────────────────────────────────────────┘ │
```

## Component Design

### 1. InstanceLock Module (`src/utils/instance-lock.ts`)

```typescript
interface LockFileData {
  pid: number;
  port: number;
  startTime: string;
  version: string;
}

class InstanceLock {
  // Check if another instance is running
  static async check(): Promise<{ running: boolean; port?: number }>;
  
  // Acquire lock (write lock file)
  static async acquire(port: number): Promise<boolean>;
  
  // Release lock (delete lock file)
  static async release(): Promise<void>;
  
  // Verify instance via health check
  static async verifyInstance(port: number): Promise<boolean>;
  
  // Get lock file path
  static getLockFilePath(): string;
}
```

### 2. Lock File Format

Location: `{projectRoot}/data/.user-feedback.lock`

```json
{
  "pid": 12345,
  "port": 5000,
  "startTime": "2026-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

### 3. Health Check Endpoint

**Path:** `GET /api/health`

**Response:**
```json
{
  "status": "ok",
  "pid": 12345,
  "port": 5000,
  "uptime": 3600,
  "version": "1.0.0",
  "activeSessions": 2
}
```

### 4. CLI Flow Changes

```typescript
// cli.ts - startMCPServer() modification
async function startMCPServer(options: Options): Promise<void> {
  // Step 1: Check for existing instance
  const instanceCheck = await InstanceLock.check();
  
  if (instanceCheck.running && instanceCheck.port) {
    // Existing instance found - return port info
    logger.info(`Existing instance running on port ${instanceCheck.port}`);
    
    if (isMCPMode) {
      // In MCP mode, we need to proxy or inform the client
      // Option A: Output port info for client to connect
      // Option B: Start in "client mode" to proxy requests
    }
    return;
  }
  
  // Step 2: No existing instance - start new server
  const server = new MCPServer(config);
  await server.start();
  
  // Step 3: Acquire lock after successful start
  await InstanceLock.acquire(server.getStatus().webPort!);
}
```

## Error Handling

### Stale Lock Detection
1. Lock file exists but process not running (PID check fails)
2. Lock file exists but health check times out
3. Lock file has invalid/corrupt data

**Resolution:** Delete stale lock file and proceed with new instance.

### Race Condition Prevention
1. Use atomic file write operations
2. Re-verify lock ownership after write
3. Use process PID as ownership proof

### Graceful Shutdown
```typescript
// WebServer graceful shutdown enhancement
private setupGracefulShutdown(): void {
  const gracefulShutdown = async (signal: string) => {
    // ... existing shutdown logic ...
    
    // Release instance lock
    await InstanceLock.release();
    
    process.exit(0);
  };
}
```

## Configuration

New config options in `Config` interface:

```typescript
interface Config {
  // ... existing options ...
  
  // Lock file path (default: data/.user-feedback.lock)
  lockFilePath?: string;
  
  // Health check timeout in ms (default: 3000)
  healthCheckTimeout?: number;
  
  // Force new instance even if one exists (default: false)
  forceNewInstance?: boolean;
}
```

## Testing Strategy

### Unit Tests
1. `InstanceLock.check()` with no lock file
2. `InstanceLock.check()` with valid lock file
3. `InstanceLock.check()` with stale lock file
4. `InstanceLock.acquire()` success case
5. `InstanceLock.release()` cleanup

### Integration Tests
1. First invocation creates lock and starts server
2. Second invocation detects existing instance
3. After server stop, new invocation starts fresh
4. Stale lock cleanup after simulated crash

## Security Considerations

1. Lock file should not contain sensitive data
2. Health check endpoint should be localhost-only by default
3. Lock file permissions should be user-only (0600)
