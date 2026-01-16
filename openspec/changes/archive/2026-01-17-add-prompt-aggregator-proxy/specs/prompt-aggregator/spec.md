# Spec: Prompt Aggregator

## ADDED Requirements

### Requirement: Unified Prompt Building
The system SHALL provide a unified `PromptAggregator` class that centralizes all prompt construction logic for both API and CLI modes.

#### Scenario: Aggregator builds complete prompt
- **GIVEN** a valid `AIReplyRequest` with all fields populated
- **WHEN** `PromptAggregator.aggregate(context)` is called
- **THEN** return an `AggregatedPrompt` containing:
  - `fullPrompt`: Complete formatted prompt string
  - `sections`: Array of `PromptSection` with name and content
  - `metadata`: `PromptMetadata` with token estimate and mode

#### Scenario: Aggregator handles missing optional fields
- **GIVEN** an `AIReplyRequest` with only required fields
- **WHEN** `PromptAggregator.aggregate(context)` is called
- **THEN** return prompt with only applicable sections
- **AND** exclude sections for missing data (userContext, toolResults)

#### Scenario: Aggregator supports API mode formatting
- **GIVEN** a `PromptContext` with `mode: 'api'`
- **WHEN** `PromptAggregator.aggregate(context)` is called
- **THEN** format prompt suitable for API provider consumption

#### Scenario: Aggregator supports CLI mode formatting
- **GIVEN** a `PromptContext` with `mode: 'cli'`
- **WHEN** `PromptAggregator.aggregate(context)` is called
- **THEN** format prompt suitable for CLI tool input with markdown headers

---

### Requirement: Component-based Architecture
The system SHALL implement prompt building using pluggable components that follow the `IPromptComponent` interface.

#### Scenario: Register custom component
- **GIVEN** a class implementing `IPromptComponent`
- **WHEN** `PromptAggregator.register(component)` is called
- **THEN** component is added to aggregation pipeline
- **AND** components are sorted by `getOrder()` value

#### Scenario: Default components registered automatically
- **GIVEN** a new `PromptAggregator` instance
- **WHEN** instance is created
- **THEN** default components are automatically registered:
  - `SystemPromptComponent` (order: 10)
  - `MCPToolsPromptComponent` (order: 20)
  - `UserContextComponent` (order: 30)
  - `ToolResultsComponent` (order: 40)
  - `AIMessageComponent` (order: 50)
  - `ClosingPromptComponent` (order: 100)

---

### Requirement: Prompt Preview Consistency
The system SHALL ensure that prompt preview uses the same aggregation logic as actual AI requests.

#### Scenario: Preview matches actual prompt
- **GIVEN** identical `AIReplyRequest` parameters
- **WHEN** `PromptAggregator.preview(request)` is called
- **AND** `PromptAggregator.aggregate(context)` is called with same request
- **THEN** both return identical `fullPrompt` content

#### Scenario: Preview includes mode information
- **GIVEN** any `AIReplyRequest`
- **WHEN** `PromptAggregator.preview(request)` is called
- **THEN** result includes:
  - `success: boolean`
  - `prompt: string`
  - `mode: 'api' | 'cli'`
  - `cliTool?: string` (when mode is 'cli')

---

### Requirement: CLI MCP Response Handling
The system SHALL provide a handler to process AI responses in CLI mode and execute MCP tool calls when detected.

#### Scenario: Detect MCP tool calls in AI response
- **GIVEN** an AI response containing MCP tool call syntax
- **WHEN** `CLIMCPResponseHandler.parseToolCalls(response)` is called
- **THEN** return array of `MCPToolCall` objects with tool name and arguments

#### Scenario: Execute detected MCP tools
- **GIVEN** an array of `MCPToolCall` objects
- **WHEN** `CLIMCPResponseHandler.executeTools(calls)` is called
- **THEN** execute each tool via `mcpClientManager`
- **AND** return array of `MCPToolResult` with success status and output

#### Scenario: Format MCP results as new prompt
- **GIVEN** an array of `MCPToolResult` objects
- **WHEN** `CLIMCPResponseHandler.formatResultsPrompt(results)` is called
- **THEN** return formatted string suitable for sending back to CLI terminal

#### Scenario: Enforce max iteration limit
- **GIVEN** MCP tool calls that trigger recursive responses
- **WHEN** iteration count exceeds configured maximum (default: 10)
- **THEN** stop iteration and return final response
- **AND** log warning about iteration limit reached

---

### Requirement: Singleton Pattern
The system SHALL implement `PromptAggregator` as a singleton to ensure global consistency.

#### Scenario: Get singleton instance
- **GIVEN** any part of the application
- **WHEN** `getPromptAggregator()` is called multiple times
- **THEN** return the same instance every time

#### Scenario: Registered components persist
- **GIVEN** a component registered via `PromptAggregator.register()`
- **WHEN** `getPromptAggregator()` is called from another module
- **THEN** the registered component is available in returned instance
