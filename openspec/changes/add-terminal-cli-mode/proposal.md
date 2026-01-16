# Proposal: Add Terminal CLI Mode for AI Responses

## Overview

This proposal adds a Terminal CLI Mode feature that allows the system to use external CLI tools (Gemini CLI, Claude CLI, etc.) for AI responses instead of direct API calls. This provides flexibility in how AI responses are generated and can leverage existing CLI tool installations.

## Motivation

Current limitations:
- The system only supports API-based AI responses
- Users who have CLI tools installed (Gemini CLI, Claude CLI) cannot leverage them
- No visibility into which CLI tools are available on the system
- API calls require API keys and may have usage costs

Benefits of CLI mode:
- **Cost reduction**: Some CLI tools have free tiers (Gemini CLI: 60 req/min free)
- **Flexibility**: Users can choose between API or CLI based on their setup
- **Existing auth**: CLI tools may already be authenticated
- **No API key management**: CLI handles authentication

## Goals

- **Settings toggle**: Add option to switch between API and CLI mode in settings page
- **CLI detection**: Automatically detect which CLI tools are installed
- **Non-interactive execution**: Execute CLI tools in non-interactive mode for each AI request
- **Response extraction**: Capture CLI output and use it as AI response
- **Terminal management page**: New UI page to view and manage CLI terminal instances
- **Error logging**: Log CLI errors to database for troubleshooting

## Non-Goals

- Interactive terminal sessions within the web UI
- Real-time streaming of CLI output (initial implementation uses buffered output)
- Supporting all possible CLI tools (focus on Gemini CLI and Claude CLI first)
- Modifying the core feedback collection mechanism

## Affected Components

### Backend (TypeScript)
- `src/utils/cli-service.ts` (new) - CLI detection and execution
- `src/utils/cli-detector.ts` (new) - Check installed CLI tools
- `src/utils/ai-service.ts` - Add CLI mode branch
- `src/types/index.ts` - New types for CLI configuration
- `src/utils/database.ts` - CLI settings and logs storage
- `src/server/web-server.ts` - New API endpoints

### Frontend (HTML/JS/CSS)
- `src/static/settings.html` - CLI mode toggle UI
- `src/static/settings.js` - CLI settings logic
- `src/static/terminals.html` (new) - Terminal list page
- `src/static/terminals.js` (new) - Terminal management logic
- `src/static/components/navbar.html` - Add Terminals nav link

### Database
- New table: `cli_settings` - Store CLI preferences
- New table: `cli_terminals` - Track terminal instances
- Existing table: `logs` - Store CLI errors

## Supported CLI Tools

### Gemini CLI
- **Detection**: `gemini --version`
- **Non-interactive command**: `gemini -p "prompt" --output-format text`
- **Installation check**: `which gemini` (Unix) / `where gemini` (Windows)

### Claude CLI
- **Detection**: `claude --version`
- **Non-interactive command**: `claude -p "prompt" --output-format text`
- **Installation check**: `which claude` (Unix) / `where claude` (Windows)

## Dependencies

- Node.js `child_process` module for CLI execution
- Existing database infrastructure for settings storage

## Success Criteria

1. Settings page shows API/CLI toggle option
2. CLI tool detection correctly identifies installed tools
3. When CLI mode is enabled, AI requests use CLI instead of API
4. CLI responses are correctly extracted and displayed
5. Terminal list page shows active CLI processes
6. CLI errors are logged to database
7. All existing tests pass
8. New unit tests for CLI services
9. Integration tests for CLI mode workflow

## Timeline

Estimated: 2-3 days

## Related Changes

- Extends `ui-optimization-unified-navigation` (navigation bar updates)

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| CLI tool not installed | Graceful fallback to API mode with user notification |
| CLI execution timeout | Configurable timeout with sensible defaults |
| CLI output parsing errors | Robust parsing with error handling |
| Cross-platform compatibility | Test on Windows, macOS, Linux |
