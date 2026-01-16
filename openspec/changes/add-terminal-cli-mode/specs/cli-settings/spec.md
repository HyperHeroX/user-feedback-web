# Spec: CLI Settings

## Overview

This spec defines the requirements for CLI mode settings configuration.

---

## ADDED Requirements

### Requirement: AI Mode Selection

Users must be able to switch between API mode and CLI mode for AI responses.

#### Scenario: Select API mode

**Given** a user is on the settings page
**When** the user selects "API" as the AI mode
**And** saves settings
**Then** the `aiMode` setting should be stored as "api"
**And** subsequent AI requests should use API calls

#### Scenario: Select CLI mode

**Given** a user is on the settings page
**When** the user selects "CLI" as the AI mode
**And** saves settings
**Then** the `aiMode` setting should be stored as "cli"
**And** subsequent AI requests should use CLI execution

---

### Requirement: CLI Tool Selection

Users must be able to select which CLI tool to use when in CLI mode.

#### Scenario: Select Gemini CLI

**Given** a user has selected CLI mode
**And** Gemini CLI is detected as installed
**When** the user selects "Gemini CLI" from the dropdown
**And** saves settings
**Then** the `cliTool` setting should be stored as "gemini"

#### Scenario: Select Claude CLI

**Given** a user has selected CLI mode
**And** Claude CLI is detected as installed
**When** the user selects "Claude CLI" from the dropdown
**And** saves settings
**Then** the `cliTool` setting should be stored as "claude"

#### Scenario: Cannot select uninstalled tool

**Given** a user has selected CLI mode
**And** a CLI tool is not installed
**When** the user views the tool dropdown
**Then** the uninstalled tool should be disabled or marked as unavailable
**And** a message should indicate "Not installed"

---

### Requirement: Timeout Configuration

Users must be able to configure the CLI execution timeout.

#### Scenario: Set custom timeout

**Given** a user is on the settings page
**When** the user sets timeout to 180 seconds
**And** saves settings
**Then** the `cliTimeout` setting should be stored as 180000 (milliseconds)
**And** CLI executions should use the new timeout value

#### Scenario: Timeout validation

**Given** a user is on the settings page
**When** the user attempts to set timeout to 0 or negative
**Then** the system should reject the value
**And** display an error message
**And** not save the invalid setting

#### Scenario: Default timeout

**Given** a new installation without existing settings
**When** CLI settings are loaded
**Then** the default timeout should be 120 seconds (120000ms)

---

### Requirement: Fallback Configuration

Users must be able to configure whether to fallback to API when CLI fails.

#### Scenario: Enable fallback

**Given** a user is on the settings page
**When** the user enables "Fallback to API"
**And** saves settings
**Then** the `cliFallbackToApi` setting should be stored as true

#### Scenario: Disable fallback

**Given** a user is on the settings page
**When** the user disables "Fallback to API"
**And** saves settings
**Then** the `cliFallbackToApi` setting should be stored as false

---

### Requirement: Settings Persistence

CLI settings must be persisted in the database.

#### Scenario: Save settings

**Given** a user has modified CLI settings
**When** the user saves settings
**Then** settings should be stored in `cli_settings` table
**And** `updated_at` timestamp should be updated

#### Scenario: Load settings on startup

**Given** CLI settings exist in database
**When** the settings page is loaded
**Then** all CLI settings should be populated with saved values

#### Scenario: Initialize default settings

**Given** no CLI settings exist in database
**When** the settings page is loaded
**Then** default values should be used:
  - `aiMode`: "api"
  - `cliTool`: "gemini"
  - `cliTimeout`: 120000
  - `cliFallbackToApi`: true

---

### Requirement: Settings API

The system must provide API endpoints for settings management.

#### Scenario: Get CLI settings via API

**Given** CLI settings exist
**When** GET `/api/cli/settings` is called
**Then** the response should include all CLI settings:
```json
{
  "success": true,
  "settings": {
    "aiMode": "cli",
    "cliTool": "gemini",
    "cliTimeout": 120000,
    "cliFallbackToApi": true
  }
}
```

#### Scenario: Update CLI settings via API

**Given** valid settings data
**When** PUT `/api/cli/settings` is called with:
```json
{
  "aiMode": "cli",
  "cliTool": "claude",
  "cliTimeout": 180000,
  "cliFallbackToApi": false
}
```
**Then** settings should be updated in database
**And** response should confirm success

#### Scenario: Validate settings on update

**Given** invalid settings data
**When** PUT `/api/cli/settings` is called with invalid values
**Then** the API should return validation error
**And** settings should not be updated

---

## MODIFIED Requirements

### Requirement: AI Settings Extension

The existing AISettings interface must be extended to include CLI-related fields.

#### Scenario: AISettings includes CLI fields

**Given** the AISettings type definition
**When** the type is examined
**Then** it should include:
  - `aiMode: 'api' | 'cli'`
  - `cliTool: string`
  - `cliTimeout: number`
  - `cliFallbackToApi: boolean`

---

## Technical Notes

- Settings are singleton (only one row in `cli_settings` table)
- Use constraint `id = 1` to ensure single settings record
- Frontend should disable CLI options when no CLI tools are detected
- Consider showing warning when switching to CLI mode without installed tools
