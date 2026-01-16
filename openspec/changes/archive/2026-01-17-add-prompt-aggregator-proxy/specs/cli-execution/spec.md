# Spec: CLI Execution (Delta)

## MODIFIED Requirements

### Requirement: CLI Provider Integration
The `CLIProvider` SHALL use `PromptAggregator` for prompt construction and integrate `CLIMCPResponseHandler` for handling AI responses that contain MCP tool calls.

#### Scenario: CLI provider uses prompt aggregator
- **GIVEN** a CLI mode AI request
- **WHEN** `CLIProvider.generateReply(request)` is called
- **THEN** use `PromptAggregator.aggregate()` to build the prompt
- **AND** NOT use internal `buildCLIPrompt()` method

#### Scenario: CLI provider handles MCP tool calls
- **GIVEN** an AI response from CLI tool containing MCP call syntax
- **WHEN** response is received in `CLIProvider.generateReply()`
- **THEN** pass response to `CLIMCPResponseHandler.handleResponse()`
- **AND** if MCP calls detected, execute them and send results back to terminal
- **AND** continue until no more MCP calls or max iterations reached

#### Scenario: CLI provider tracks MCP iterations
- **GIVEN** MCP tool calls detected in response
- **WHEN** handling response iteratively
- **THEN** update CLI terminal status to 'mcp-processing'
- **AND** log each MCP execution to `cli_execution_logs`
- **AND** return final response when iteration complete

---

### Requirement: Terminal Instance Management
Each project SHALL have a dedicated terminal instance for CLI mode operations.

#### Scenario: Create terminal for new project
- **GIVEN** a CLI request for a project without existing terminal
- **WHEN** `CLIProvider.generateReply(request)` is called
- **THEN** create new terminal instance with:
  - `id`: Unique identifier based on project path and CLI tool
  - `projectName`: From request
  - `projectPath`: From request
  - `tool`: Selected CLI tool name
  - `status`: 'running'

#### Scenario: Reuse existing terminal
- **GIVEN** a CLI request for a project with existing terminal
- **WHEN** `CLIProvider.generateReply(request)` is called
- **THEN** reuse existing terminal instance
- **AND** update `status` to 'running'
- **AND** update `last_activity_at` timestamp
