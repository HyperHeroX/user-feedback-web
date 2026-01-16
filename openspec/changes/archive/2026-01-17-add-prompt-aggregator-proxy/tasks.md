# Tasks: Add Prompt Aggregator Proxy

## Phase 1: Core Infrastructure

### T1. Add Prompt Aggregator Types ✅
**File:** `src/types/ai-provider.ts`
**Effort:** Small
**Dependencies:** None

- [x] Add `IPromptComponent` interface
- [x] Add `PromptContext` interface
- [x] Add `AggregatedPrompt` interface
- [x] Add `PromptSection` interface
- [x] Add `PromptMetadata` interface
- [x] Add `PromptPreviewResult` type
- [x] Add `MCPToolCall` interface
- [x] Add `MCPToolResult` interface
- [x] Add `CLIHandlerResult` interface

**Validation:** TypeScript compiles without errors ✅

---

### T2. Create Prompt Component Base ✅
**File:** `src/utils/prompt-aggregator/components/base-component.ts`
**Effort:** Small
**Dependencies:** T1

- [x] Create abstract `BasePromptComponent` class
- [x] Implement `getName()` method
- [x] Implement `getOrder()` method
- [x] Define abstract `build(context: PromptContext)` method

**Validation:** Unit test for base component

---

### T3. Implement System Prompt Component ✅
**File:** `src/utils/prompt-aggregator/components/system-prompt.ts`
**Effort:** Small
**Dependencies:** T2

- [x] Create `SystemPromptComponent` class
- [x] Implement `build()` to return formatted system prompt
- [x] Handle empty/missing system prompt gracefully
- [x] Set order to 10

**Validation:** Unit test for system prompt component

---

### T4. Implement MCP Tools Prompt Component ✅
**File:** `src/utils/prompt-aggregator/components/mcp-tools.ts`
**Effort:** Medium
**Dependencies:** T2

- [x] Create `MCPToolsPromptComponent` class
- [x] Implement `build()` to return formatted MCP tools list
- [x] Handle variable substitution (`{project_name}`, `{project_path}`)
- [x] Fetch tools from `mcpClientManager`
- [x] Set order to 20

**Validation:** Unit test for MCP tools component

---

### T5. Implement User Context Component ✅
**File:** `src/utils/prompt-aggregator/components/user-context.ts`
**Effort:** Small
**Dependencies:** T2

- [x] Create `UserContextComponent` class
- [x] Implement `build()` to return formatted user context
- [x] Handle empty/missing context gracefully
- [x] Set order to 30

**Validation:** Unit test for user context component

---

### T6. Implement Tool Results Component ✅
**File:** `src/utils/prompt-aggregator/components/tool-results.ts`
**Effort:** Small
**Dependencies:** T2

- [x] Create `ToolResultsComponent` class
- [x] Implement `build()` to return formatted tool results
- [x] Handle empty/missing results gracefully
- [x] Set order to 40

**Validation:** Unit test for tool results component

---

### T7. Implement AI Message Component ✅
**File:** `src/utils/prompt-aggregator/components/ai-message.ts`
**Effort:** Small
**Dependencies:** T2

- [x] Create `AIMessageComponent` class
- [x] Implement `build()` to return formatted AI message
- [x] Set order to 50

**Validation:** Unit test for AI message component

---

### T8. Implement Closing Prompt Component ✅
**File:** `src/utils/prompt-aggregator/components/closing.ts`
**Effort:** Small
**Dependencies:** T2

- [x] Create `ClosingPromptComponent` class
- [x] Implement `build()` to return closing prompt text
- [x] Support different closing text for API/CLI modes
- [x] Set order to 100

**Validation:** Unit test for closing component

---

### T9. Create Prompt Aggregator Core ✅
**File:** `src/utils/prompt-aggregator/prompt-aggregator.ts`
**Effort:** Medium
**Dependencies:** T3-T8

- [x] Create `PromptAggregator` class with Singleton pattern
- [x] Implement `register(component)` method
- [x] Implement `aggregate(context)` method
- [x] Implement `preview(request)` method
- [x] Auto-register default components on initialization
- [x] Sort components by order before aggregation

**Validation:** Unit tests for aggregator logic

---

### T10. Create Prompt Aggregator Index ✅
**File:** `src/utils/prompt-aggregator/index.ts`
**Effort:** Small
**Dependencies:** T9

- [x] Export `PromptAggregator` class
- [x] Export all component classes
- [x] Export interfaces and types
- [x] Create factory function `getPromptAggregator()`

**Validation:** Imports work correctly ✅

---

## Phase 2: CLI MCP Handler

### T11. Create CLI MCP Response Handler ✅
**File:** `src/utils/prompt-aggregator/handlers/cli-mcp-handler.ts`
**Effort:** Large
**Dependencies:** T1, T10

- [x] Create `CLIMCPResponseHandler` class
- [x] Implement `parseToolCalls(response)` to detect MCP calls in AI output
- [x] Implement `executeTools(calls)` to run MCP tools
- [x] Implement `formatResultsPrompt(results)` to format MCP results
- [x] Implement `handleResponse()` for full workflow
- [x] Add max iteration limit (configurable, default 10)
- [x] Add logging for MCP call detection and execution

**Validation:** Unit tests with mocked MCP client

---

## Phase 3: Provider Integration

### T12. Refactor API Provider to Use Aggregator ✅
**File:** `src/utils/api-provider.ts`
**Effort:** Medium
**Dependencies:** T10

- [x] Import `PromptAggregator`
- [x] Replace `buildPrompt()` method with aggregator call
- [x] Update `generateReply()` to use aggregated prompt
- [x] Maintain backward compatibility
- [x] Keep existing caching logic

**Validation:** Existing API tests pass ✅

---

### T13. Refactor CLI Provider to Use Aggregator ✅
**File:** `src/utils/cli-provider.ts`
**Effort:** Medium
**Dependencies:** T10, T11

- [x] Import `PromptAggregator` and `CLIMCPResponseHandler`
- [x] Replace `buildCLIPrompt()` method with aggregator call
- [x] Integrate MCP response handler in `generateReply()`
- [x] Implement MCP call loop with iteration limit
- [x] Update terminal status during MCP handling

**Validation:** CLI mode tests pass ✅

---

### T14. Clean Up ai-service.ts ✅
**File:** `src/utils/ai-service.ts`
**Effort:** Small
**Dependencies:** T12, T13

- [x] Remove duplicate `buildPrompt()` function
- [x] Remove duplicate `buildCLIPrompt()` function
- [x] Update `getPromptPreview()` to use `PromptAggregator`
- [x] Keep exported functions working as before

**Validation:** All existing tests pass ✅

---

## Phase 4: Testing

### T15. Unit Tests for Prompt Components ✅
**File:** `src/__tests__/prompt-aggregator.test.ts`
**Effort:** Medium
**Dependencies:** T10

- [x] Test each component individually
- [x] Test aggregator with all components
- [x] Test component ordering
- [x] Test empty/missing data handling
- [x] Test mode-specific formatting

**Validation:** All unit tests pass ✅ (37 tests)

---

### T16. Unit Tests for CLI MCP Handler ✅
**File:** `src/__tests__/cli-mcp-handler.test.ts`
**Effort:** Medium
**Dependencies:** T11

- [x] Test MCP call detection patterns
- [x] Test tool execution with mocked MCP client
- [x] Test results formatting
- [x] Test max iteration limit
- [x] Test error handling

**Validation:** All unit tests pass ✅ (5 tests)

---

### T17. Integration Tests ✅
**File:** `src/__tests__/prompt-aggregator-integration.test.ts`
**Effort:** Medium
**Dependencies:** T14

- [x] Test full flow with API provider
- [x] Test full flow with CLI provider
- [x] Test `getPromptPreview()` consistency
- [x] Test MCP tool call loop in CLI mode

**Validation:** All integration tests pass ✅

---

### T18. Build and Lint Verification ✅
**Effort:** Small
**Dependencies:** T17

- [x] Run `npm run build` successfully
- [x] Run `npm run lint` with no errors
- [x] Run `npm test` with all tests passing (185 tests)

**Validation:** Build passes with no errors ✅

---

## Phase 5: Browser E2E Testing

### T19. E2E Test - Existing Functionality ✅
**Effort:** Medium
**Dependencies:** T18

- [x] Test main page (Feedback UI)
- [x] Test MCP Settings page
- [x] Test Dashboard page
- [x] Test Logs page
- [x] Test Settings page
- [x] Test Terminals page

**Validation:** All pages load and function correctly ✅

---

### T20. E2E Test - Prompt Preview ✅
**Effort:** Small
**Dependencies:** T18

- [x] Test prompt preview in feedback UI
- [x] Verify preview matches actual prompt format
- [x] Test API mode preview
- [x] Test CLI mode preview

**Validation:** Preview functionality works correctly ✅

---

## Task Summary

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1: Core Infrastructure | T1-T10 | 10 tasks |
| Phase 2: CLI MCP Handler | T11 | 1 task |
| Phase 3: Provider Integration | T12-T14 | 3 tasks |
| Phase 4: Testing | T15-T18 | 4 tasks |
| Phase 5: Browser E2E Testing | T19-T20 | 2 tasks |

**Total:** 20 tasks
