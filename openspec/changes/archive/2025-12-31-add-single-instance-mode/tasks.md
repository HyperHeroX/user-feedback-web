# Tasks: Add Single Instance Mode

## Task List

### Phase 1: Core Infrastructure

- [x] **T1: Create InstanceLock Module**
  - File: `src/utils/instance-lock.ts`
  - Create `LockFileData` interface
  - Implement `InstanceLock` class with:
    - `check()` - Check for existing instance
    - `acquire(port)` - Write lock file
    - `release()` - Delete lock file
    - `verifyInstance(port)` - HTTP health check
    - `getLockFilePath()` - Get lock file location
  - Dependencies: None
  - Status: ✅ Completed

- [x] **T2: Add Health Check Endpoint**
  - File: `src/server/web-server.ts`
  - Add `GET /api/health` endpoint
  - Return: status, pid, port, uptime, version, activeSessions
  - Dependencies: None
  - Status: ✅ Completed

### Phase 2: Integration

- [x] **T3: Update Config Interface**
  - File: `src/types/index.ts`
  - Add: `lockFilePath?: string`
  - Add: `healthCheckTimeout?: number`
  - Add: `forceNewInstance?: boolean`
  - Dependencies: None
  - Status: ✅ Completed

- [x] **T4: Update Config Defaults**
  - File: `src/config/index.ts`
  - Set default lock file path: `data/.user-feedback.lock`
  - Set default health check timeout: 3000ms
  - Set default forceNewInstance: false
  - Dependencies: T3
  - Status: ✅ Completed

- [x] **T5: Modify CLI Startup Flow**
  - File: `src/cli.ts`
  - Add instance check before `new MCPServer()`
  - If running instance detected, output port info and exit
  - Acquire lock after successful server start
  - Add `--force-new` CLI option
  - Dependencies: T1, T3, T4
  - Status: ✅ Completed

- [x] **T6: Add Lock Release on Shutdown**
  - File: `src/server/web-server.ts`
  - Call `InstanceLock.release()` in graceful shutdown
  - Handle both normal shutdown and crash scenarios
  - Dependencies: T1
  - Status: ✅ Completed

### Phase 3: Testing

- [x] **T7: Unit Tests for InstanceLock**
  - File: `src/__tests__/instance-lock.test.ts`
  - Test `check()` with no lock file
  - Test `check()` with valid lock file
  - Test `check()` with stale lock file
  - Test `acquire()` success case
  - Test `release()` cleanup
  - Dependencies: T1
  - Status: ✅ Completed (12 tests passing)

- [ ] **T8: Integration Test for Single Instance**
  - File: `src/__tests__/single-instance.test.ts`
  - Test first invocation creates lock
  - Test second invocation detects instance
  - Test cleanup after server stop
  - Dependencies: T1, T2, T5, T6
  - Status: Skipped (manual testing recommended)

### Phase 4: Documentation

- [ ] **T9: Update README**
  - File: `README.md`
  - Document single instance behavior
  - Document `--force-new` option
  - Dependencies: T5
  - Status: Pending

## Execution Order

```
T1 ──┬──▶ T5 ──┬──▶ T8
     │         │
T2 ──┤         │
     │         │
T3 ──┼──▶ T4 ──┤
     │         │
     └──▶ T6 ──┤
               │
T7 ────────────┴──▶ T9
```

## Validation Checklist

Before marking complete:
- [ ] `npm run build` succeeds
- [ ] `npm run test` all tests pass
- [ ] Manual test: first invocation starts server
- [ ] Manual test: second invocation detects existing
- [ ] Manual test: after stop, new instance starts fresh
- [ ] Browser test: UI accessible during entire flow
