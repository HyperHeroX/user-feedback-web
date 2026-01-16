# Tasks: Add Terminal CLI Mode for AI Responses

## Phase 1: Core Infrastructure

### T1. Add CLI Types and Interfaces
**File:** `src/types/index.ts`
**Effort:** Small
**Dependencies:** None

- [ ] Add `AIMode` type ('api' | 'cli')
- [ ] Add `CLIToolInfo` interface
- [ ] Add `CLIToolConfig` interface
- [ ] Add `CLITerminal` interface
- [ ] Add `CLIExecutionLog` interface
- [ ] Add `CLISettings` interface
- [ ] Extend `AISettings` with CLI fields

**Validation:** TypeScript compiles without errors

---

### T2. Create CLI Detector Service
**File:** `src/utils/cli-detector.ts`
**Effort:** Medium
**Dependencies:** T1

- [ ] Implement `detectCLITools()` - detect all supported CLI tools
- [ ] Implement `checkToolInstalled(toolName)` - check single tool
- [ ] Implement `getToolVersion(toolName)` - get version string
- [ ] Handle Windows vs Unix command differences (`where` vs `which`)
- [ ] Add result caching with TTL (5 minutes)
- [ ] Export all functions and types

**Validation:** Unit tests for detection logic

---

### T3. Create CLI Executor Service
**File:** `src/utils/cli-executor.ts`
**Effort:** Medium
**Dependencies:** T1, T2

- [ ] Implement `executeCLI(options)` - main execution function
- [ ] Implement `buildCommand(options)` - construct command array
- [ ] Implement `parseOutput(rawOutput, tool)` - clean CLI output
- [ ] Add timeout handling with configurable limit
- [ ] Add proper error handling with `CLIError` class
- [ ] Handle process cleanup on timeout

**Validation:** Unit tests with mocked child_process

---

### T4. Add Database Schema for CLI
**File:** `src/utils/database.ts`
**Effort:** Medium
**Dependencies:** T1

- [ ] Add `cli_settings` table creation in `createTables()`
- [ ] Add `cli_terminals` table creation
- [ ] Add `cli_execution_logs` table creation
- [ ] Implement `getCLISettings()` function
- [ ] Implement `updateCLISettings(settings)` function
- [ ] Implement `createCLITerminal(terminal)` function
- [ ] Implement `updateCLITerminal(id, data)` function
- [ ] Implement `getCLITerminals()` function
- [ ] Implement `deleteCLITerminal(id)` function
- [ ] Implement `insertCLIExecutionLog(log)` function
- [ ] Implement `getCLIExecutionLogs(terminalId, limit)` function

**Validation:** Database migrations run without errors

---

## Phase 2: AI Service Integration

### T5. Integrate CLI Mode into AI Service
**File:** `src/utils/ai-service.ts`
**Effort:** Medium
**Dependencies:** T2, T3, T4

- [ ] Import CLI executor and detector
- [ ] Add `generateCLIReply()` function
- [ ] Modify `generateAIReply()` to check AI mode
- [ ] Route to CLI or API based on settings
- [ ] Implement fallback logic when CLI fails
- [ ] Add CLI execution logging
- [ ] Update terminal activity on each execution

**Validation:** Integration test for CLI mode flow

---

### T6. Add CLI API Endpoints
**File:** `src/server/web-server.ts`
**Effort:** Medium
**Dependencies:** T2, T3, T4

- [ ] Add `GET /api/cli/detect` - detect installed tools
- [ ] Add `GET /api/cli/settings` - get CLI settings
- [ ] Add `PUT /api/cli/settings` - update CLI settings
- [ ] Add `GET /api/cli/terminals` - list terminals
- [ ] Add `DELETE /api/cli/terminals/:id` - remove terminal
- [ ] Add `GET /api/cli/terminals/:id/logs` - get terminal logs
- [ ] Add proper error responses and validation

**Validation:** API endpoints respond correctly

---

## Phase 3: Frontend Implementation

### T7. Update Settings Page for CLI Mode
**Files:** `src/static/settings.html`, `src/static/settings.js`
**Effort:** Medium
**Dependencies:** T6

- [ ] Add "AI Mode" section to settings.html
- [ ] Add toggle switch for API/CLI mode
- [ ] Add CLI tool dropdown selector
- [ ] Add timeout configuration input
- [ ] Add fallback toggle option
- [ ] Display detected CLI tools with status indicators
- [ ] Implement settings save/load logic in settings.js
- [ ] Add tool detection on page load

**Validation:** UI allows CLI mode configuration

---

### T8. Create Terminal List Page
**Files:** `src/static/terminals.html`, `src/static/terminals.js`, `src/static/terminals.css`
**Effort:** Large
**Dependencies:** T6

- [ ] Create `terminals.html` with page structure
- [ ] Include navbar component
- [ ] Create terminal card layout (similar to dashboard projects)
- [ ] Show project name, path, CLI tool, status
- [ ] Add action buttons (view logs, stop)
- [ ] Create `terminals.js` for page logic
- [ ] Implement terminal list fetching and rendering
- [ ] Implement log viewer modal
- [ ] Add auto-refresh (every 5 seconds)
- [ ] Create `terminals.css` for styling
- [ ] Ensure responsive design

**Validation:** Terminal list displays correctly

---

### T9. Update Navigation Bar
**File:** `src/static/components/navbar.html`
**Effort:** Small
**Dependencies:** T8

- [ ] Add "Terminals" link to navigation
- [ ] Update active state logic

**Validation:** Navigation includes Terminals link

---

## Phase 4: Testing

### T10. Unit Tests for CLI Detector
**File:** `src/__tests__/cli-detector.test.ts`
**Effort:** Medium
**Dependencies:** T2

- [ ] Test `detectCLITools()` returns correct format
- [ ] Test tool detection with mocked `which`/`where`
- [ ] Test version extraction with mocked execution
- [ ] Test caching behavior
- [ ] Test error handling for missing tools
- [ ] Test Windows vs Unix path handling

**Validation:** All unit tests pass

---

### T11. Unit Tests for CLI Executor
**File:** `src/__tests__/cli-executor.test.ts`
**Effort:** Medium
**Dependencies:** T3

- [ ] Test `executeCLI()` with successful execution
- [ ] Test timeout handling
- [ ] Test error handling for failed execution
- [ ] Test command building for Gemini CLI
- [ ] Test command building for Claude CLI
- [ ] Test output parsing

**Validation:** All unit tests pass

---

### T12. Integration Tests for CLI Mode
**File:** `src/__tests__/cli-integration.test.ts`
**Effort:** Large
**Dependencies:** T5, T6

- [ ] Test full flow: settings → execution → response
- [ ] Test API fallback when CLI fails
- [ ] Test terminal creation and tracking
- [ ] Test execution logging
- [ ] Test settings persistence
- [ ] Test API endpoints

**Validation:** All integration tests pass

---

### T13. E2E Browser Tests
**Effort:** Medium
**Dependencies:** T7, T8, T9

- [ ] Test settings page CLI mode toggle
- [ ] Test CLI tool selection
- [ ] Test terminal list page rendering
- [ ] Test terminal log viewer
- [ ] Test navigation flow

**Validation:** All E2E tests pass with Browser Automation Tools

---

## Phase 5: Documentation and Cleanup

### T14. Update Documentation
**Effort:** Small
**Dependencies:** All previous tasks

- [ ] Update README with CLI mode documentation
- [ ] Add CLI configuration guide
- [ ] Document supported CLI tools
- [ ] Add troubleshooting section

**Validation:** Documentation is clear and complete

---

## Task Summary

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Core Infrastructure | T1-T4 | 4 tasks |
| Phase 2: AI Service Integration | T5-T6 | 2 tasks |
| Phase 3: Frontend Implementation | T7-T9 | 3 tasks |
| Phase 4: Testing | T10-T13 | 4 tasks |
| Phase 5: Documentation | T14 | 1 task |
| **Total** | | **14 tasks** |

## Parallel Execution Opportunities

```
Phase 1:
  T1 (types) ─┬─► T2 (detector) ─┬─► T5 (AI service)
              │                   │
              ├─► T3 (executor) ──┤
              │                   │
              └─► T4 (database) ──┘

Phase 2:
  T5 ──► T6 (API endpoints)

Phase 3:
  T6 ─┬─► T7 (settings UI)
      │
      └─► T8 (terminals page) ──► T9 (navbar)

Phase 4:
  T2 ──► T10 (detector tests)
  T3 ──► T11 (executor tests)
  T5,T6 ──► T12 (integration tests)
  T7,T8,T9 ──► T13 (E2E tests)

Phase 5:
  All ──► T14 (docs)
```

## Definition of Done

Each task is considered complete when:
1. Code is implemented following project style guidelines
2. No TypeScript compilation errors
3. Related unit/integration tests pass
4. No regressions in existing tests
5. Code reviewed (self-review for solo development)
