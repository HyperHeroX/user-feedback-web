# Tasks: add-prompt-customization-ui

## Status Summary

| Task | Status | Notes |
|------|--------|-------|
| T001 | ✅ Done | Type definitions |
| T002 | ✅ Done | Database schema |
| T003 | ✅ Done | API endpoints |
| T004 | ✅ Done | PromptAggregator modification |
| T005 | ✅ Done | Settings HTML |
| T006 | ✅ Done | Settings JS |
| T007 | ✅ Done | Build and test |
| T008 | ✅ Done | Browser UI test |

---

## Phase 1: Backend Infrastructure

### T001: Add PromptConfig Type Definitions

- **File**: `src/types/ai-provider.ts`
- **Action**: Add PromptConfig, PromptConfigRequest interfaces
- **Verification**: TypeScript compilation passes
- **Parallelizable**: Yes

### T002: Add Database Schema and CRUD

- **File**: `src/utils/database.ts`
- **Action**: 
  - Add prompt_configs table creation
  - Add initDefaultPromptConfigs()
  - Add getPromptConfigs()
  - Add updatePromptConfigs()
  - Add resetPromptConfigs()
- **Dependencies**: T001
- **Verification**: Functions callable without error
- **Parallelizable**: No

### T003: Add API Endpoints

- **File**: `src/server/web-server.ts`
- **Action**:
  - GET /api/settings/prompts
  - PUT /api/settings/prompts
  - POST /api/settings/prompts/reset
- **Dependencies**: T002
- **Verification**: curl commands return expected responses
- **Parallelizable**: No

### T004: Modify PromptAggregator

- **File**: `src/utils/prompt-aggregator/prompt-aggregator.ts`
- **Action**:
  - Add getPromptConfigs import
  - Modify aggregate() to use DB configs
  - Support isFirstCall for order selection
- **Dependencies**: T002
- **Verification**: Build passes
- **Parallelizable**: No

---

## Phase 2: Frontend UI

### T005: Add Settings HTML Sections

- **File**: `src/static/settings.html`
- **Action**:
  - Add "AI 提示詞設定" section after Self-Probe
  - Add "擴展 API 提供商" section with NVIDIA/Z.AI tabs
  - Add required CSS styles
- **Dependencies**: None
- **Verification**: HTML renders correctly
- **Parallelizable**: Yes

### T006: Add Settings JS Handlers

- **File**: `src/static/settings.js`
- **Action**:
  - Add element references
  - Add loadPromptConfigs()
  - Add renderPromptConfigs()
  - Add savePromptConfigs()
  - Add resetPromptConfigs()
  - Add provider tab handlers
  - Add NVIDIA/Z.AI settings handlers
- **Dependencies**: T005
- **Verification**: UI interactions work correctly
- **Parallelizable**: No

---

## Phase 3: Verification

### T007: Build and Unit Test

- **File**: N/A
- **Action**:
  - Run `npm run build`
  - Run `npm test`
- **Dependencies**: T001-T006
- **Verification**: Build succeeds, all tests pass
- **Parallelizable**: No

### T008: Browser UI Test

- **File**: N/A
- **Action**:
  - Navigate to settings page
  - Verify new sections visible
  - Test save/load functionality
  - Test reset functionality
- **Dependencies**: T007
- **Verification**: All UI interactions work
- **Parallelizable**: No

---

## Execution Notes

1. T001-T004 are backend tasks, must be sequential
2. T005 can be done in parallel with T001-T004
3. T006 depends on T003 (API) and T005 (HTML)
4. T007-T008 are final verification steps
