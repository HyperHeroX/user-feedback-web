# Spec: CLI Execution

## Overview

This spec defines the requirements for executing CLI tools in non-interactive mode to generate AI responses.

---

## ADDED Requirements

### Requirement: Non-Interactive CLI Execution

The system must execute CLI tools in non-interactive mode, passing prompts and receiving responses.

#### Scenario: Execute Gemini CLI successfully

**Given** Gemini CLI is installed
**And** the user has configured CLI mode with tool "gemini"
**When** the system executes Gemini CLI with a prompt
**Then** the command executed should be: `gemini -p "<prompt>" --output-format text`
**And** the response should contain the AI-generated text
**And** the execution result should indicate success

#### Scenario: Execute Claude CLI successfully

**Given** Claude CLI is installed
**And** the user has configured CLI mode with tool "claude"
**When** the system executes Claude CLI with a prompt
**Then** the command executed should be: `claude -p "<prompt>" --output-format text`
**And** the response should contain the AI-generated text
**And** the execution result should indicate success

#### Scenario: Handle CLI execution failure

**Given** a CLI tool is configured
**When** the CLI execution fails (non-zero exit code)
**Then** the execution result should indicate failure
**And** the error message should be captured
**And** the exit code should be recorded

---

### Requirement: Execution Timeout

The system must enforce timeouts on CLI executions to prevent hanging.

#### Scenario: Execution completes within timeout

**Given** CLI timeout is set to 120 seconds
**When** CLI execution completes in 30 seconds
**Then** the response should be returned normally
**And** execution time should be recorded

#### Scenario: Execution exceeds timeout

**Given** CLI timeout is set to 120 seconds
**When** CLI execution does not complete within 120 seconds
**Then** the CLI process should be terminated
**And** the execution result should indicate timeout error
**And** error code should be `CLI_TIMEOUT`

---

### Requirement: Working Directory Support

The system must support setting the working directory for CLI execution.

#### Scenario: Execute CLI in project directory

**Given** a project path is specified
**When** CLI execution is performed
**Then** the CLI should run in the specified project directory
**And** the CLI should have access to project files for context

#### Scenario: Execute CLI without project directory

**Given** no project path is specified
**When** CLI execution is performed
**Then** the CLI should run in the system's current working directory

---

### Requirement: Output Parsing

The system must parse and clean CLI output for use as AI response.

#### Scenario: Parse clean text output

**Given** CLI returns plain text output
**When** output is parsed
**Then** the parsed result should contain only the AI response
**And** any CLI status messages should be removed

#### Scenario: Handle output with ANSI codes

**Given** CLI returns output with ANSI escape codes
**When** output is parsed
**Then** ANSI codes should be stripped
**And** clean text should be returned

#### Scenario: Handle empty output

**Given** CLI returns empty output
**When** output is parsed
**Then** the system should return empty string
**And** not throw an error

---

### Requirement: Error Logging

The system must log CLI execution errors to the database.

#### Scenario: Log execution error

**Given** CLI execution fails
**When** the error is processed
**Then** an error log entry should be created in the database
**And** the log should include:
  - CLI tool name
  - Prompt (truncated if long)
  - Error message
  - Exit code
  - Timestamp

#### Scenario: Log timeout error

**Given** CLI execution times out
**When** the timeout is processed
**Then** an error log entry should be created
**And** the log should indicate timeout as the error type

---

### Requirement: API Fallback

The system should support falling back to API when CLI fails.

#### Scenario: Fallback enabled and CLI fails

**Given** CLI fallback to API is enabled
**And** CLI execution fails
**When** the failure is handled
**Then** the system should retry using API mode
**And** log the fallback occurrence
**And** return the API response

#### Scenario: Fallback disabled and CLI fails

**Given** CLI fallback to API is disabled
**And** CLI execution fails
**When** the failure is handled
**Then** the system should return the error
**And** not attempt API fallback

---

## Technical Notes

- Use `child_process.spawn` for better control over process lifecycle
- Set `shell: true` for proper command parsing
- Capture both stdout and stderr
- Handle process signals (SIGTERM, SIGKILL) for timeout cleanup
- Escape special characters in prompts to prevent shell injection
