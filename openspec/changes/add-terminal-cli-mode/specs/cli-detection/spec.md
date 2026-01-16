# Spec: CLI Detection

## Overview

This spec defines the requirements for detecting installed CLI tools on the user's system.

---

## ADDED Requirements

### Requirement: CLI Tool Detection

The system must be able to detect whether supported CLI tools (Gemini CLI, Claude CLI) are installed on the user's system.

#### Scenario: Detect Gemini CLI when installed

**Given** the Gemini CLI is installed on the system
**When** the system performs CLI detection
**Then** the detection result should include:
  - `name`: "gemini"
  - `installed`: true
  - `version`: the actual version string (e.g., "0.22.2")
  - `path`: the full path to the executable

#### Scenario: Detect Gemini CLI when not installed

**Given** the Gemini CLI is not installed on the system
**When** the system performs CLI detection
**Then** the detection result should include:
  - `name`: "gemini"
  - `installed`: false
  - `version`: null
  - `path`: null

#### Scenario: Detect Claude CLI when installed

**Given** the Claude CLI is installed on the system
**When** the system performs CLI detection
**Then** the detection result should include:
  - `name`: "claude"
  - `installed`: true
  - `version`: the actual version string
  - `path`: the full path to the executable

#### Scenario: Detect Claude CLI when not installed

**Given** the Claude CLI is not installed on the system
**When** the system performs CLI detection
**Then** the detection result should include:
  - `name`: "claude"
  - `installed`: false
  - `version`: null
  - `path`: null

---

### Requirement: Cross-Platform Detection

The system must support CLI detection on Windows, macOS, and Linux.

#### Scenario: Detect CLI on Windows

**Given** the system is running on Windows
**When** the system performs CLI detection
**Then** the system should use `where <tool>` command to locate executables
**And** handle Windows-specific path formats

#### Scenario: Detect CLI on Unix-like systems

**Given** the system is running on macOS or Linux
**When** the system performs CLI detection
**Then** the system should use `which <tool>` command to locate executables
**And** handle Unix-style path formats

---

### Requirement: Detection Caching

The system must cache detection results to avoid repeated expensive operations.

#### Scenario: Return cached result within TTL

**Given** a CLI detection was performed less than 5 minutes ago
**When** the system is asked to detect CLI tools again
**Then** the system should return the cached result
**And** not execute new detection commands

#### Scenario: Refresh detection after TTL expires

**Given** a CLI detection was performed more than 5 minutes ago
**When** the system is asked to detect CLI tools again
**Then** the system should perform fresh detection
**And** update the cache with new results

---

### Requirement: API Endpoint for Detection

The system must expose an API endpoint for frontend to query detected CLI tools.

#### Scenario: API returns detected tools

**Given** a user requests CLI detection via API
**When** GET `/api/cli/detect` is called
**Then** the response should be JSON with structure:
```json
{
  "success": true,
  "tools": [
    {
      "name": "gemini",
      "installed": true,
      "version": "0.22.2",
      "path": "/usr/local/bin/gemini"
    },
    {
      "name": "claude", 
      "installed": false,
      "version": null,
      "path": null
    }
  ],
  "timestamp": "2024-12-26T00:00:00.000Z"
}
```

#### Scenario: API handles detection errors gracefully

**Given** an error occurs during CLI detection
**When** GET `/api/cli/detect` is called
**Then** the response should indicate failure
**And** include an error message
**And** return HTTP status 500

---

## Technical Notes

- Use `child_process.exec` for command execution
- Set reasonable timeout (5 seconds) for detection commands
- Version extraction uses `<tool> --version` or `<tool> -v`
- Handle cases where tool is installed but not in PATH
