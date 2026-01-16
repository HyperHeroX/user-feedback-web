# Spec: Deferred MCP Server Startup

## Overview

This specification defines the behavior for deferring MCP Server startup until the AI provides project context information through its first `collect_feedback` call.

---

## ADDED Requirements

### Requirement: Deferred Startup Configuration

The system SHALL allow MCP Servers to be configured for deferred startup until project information is available.

#### Scenario: Configure Serena with deferred startup
- **Given** a user is on the MCP Settings page
- **When** the user creates or edits an MCP Server configuration
- **Then** a "Deferred Startup" toggle option MUST be available
- **And** when enabled, a "Startup Args Template" input field SHALL be shown
- **And** the help text MUST explain available placeholders: `{project_path}`, `{project_name}`

#### Scenario: Save deferred startup configuration
- **Given** a user enables "Deferred Startup" for a server
- **And** enters `{project_path}` in the args template
- **When** the user saves the configuration
- **Then** the `deferred_startup` flag SHALL be stored as `true` in the database
- **And** the args template MUST be stored in `startup_args_template`

---

### Requirement: Deferred Server Startup Behavior

The system SHALL NOT start MCP Servers with deferred startup enabled at system boot.

#### Scenario: System boot with deferred servers
- **Given** a system with one MCP Server configured with `deferredStartup=true`
- **And** one MCP Server configured with `deferredStartup=false`
- **When** the system starts
- **Then** only the non-deferred server SHALL be started automatically
- **And** the deferred server MUST remain in "pending" status
- **And** a log message SHALL indicate deferred servers are waiting

#### Scenario: System boot with only deferred servers
- **Given** all enabled MCP Servers have `deferredStartup=true`
- **When** the system starts
- **Then** no MCP Servers SHALL be started automatically
- **And** a log message MUST indicate servers are waiting for project information

---

### Requirement: Trigger Deferred Startup on AI Report

The system SHALL start deferred MCP Servers when the AI sends its first `collect_feedback` call with project information.

#### Scenario: First AI report triggers deferred startup
- **Given** a deferred MCP Server "Serena" with args template containing `{project_path}`
- **And** the AI has not yet sent any reports
- **When** the AI calls `collect_feedback` with `project_path="/path/to/project"` and `project_name="my-project"`
- **Then** the deferred server SHALL start with `{project_path}` replaced by `/path/to/project`
- **And** `{project_name}` MUST be replaced by `my-project`
- **And** a log message SHALL indicate deferred servers are starting

#### Scenario: Subsequent reports do not re-trigger startup
- **Given** a deferred MCP Server has already been started after the first AI report
- **When** the AI sends another `collect_feedback` call with different project information
- **Then** the server SHALL NOT be restarted
- **And** the original project context MUST remain in use

#### Scenario: AI report without project path
- **Given** a deferred MCP Server waiting for startup
- **When** the AI calls `collect_feedback` without `project_path`
- **Then** the deferred server SHALL remain in "pending" status
- **And** no error MUST be thrown

---

### Requirement: Placeholder Substitution

The system SHALL support variable substitution in MCP Server arguments using placeholders.

#### Scenario: Substitute project_path placeholder
- **Given** an args template `["start-mcp-server", "--project", "{project_path}"]`
- **And** a project path `/home/user/my-project`
- **When** the server is started
- **Then** the actual args SHALL become `["start-mcp-server", "--project", "/home/user/my-project"]`

#### Scenario: Substitute project_name placeholder
- **Given** an args template `["start", "--name", "{project_name}"]`
- **And** a project name `MyAwesomeProject`
- **When** the server is started
- **Then** the actual args SHALL become `["start", "--name", "MyAwesomeProject"]`

#### Scenario: Multiple placeholders in one arg
- **Given** an args template `["--config", "{project_path}/{project_name}.json"]`
- **And** project path `/home/user` and project name `app`
- **When** the server is started
- **Then** the actual args SHALL become `["--config", "/home/user/app.json"]`

#### Scenario: No placeholders in template
- **Given** an args template with no placeholders `["start", "--verbose"]`
- **When** the server is started
- **Then** the args SHALL remain unchanged `["start", "--verbose"]`

---

## MODIFIED Requirements

### Requirement: autoStartMCPServers Behavior

The existing `autoStartMCPServers` function SHALL be modified to exclude deferred servers from automatic startup.

#### Scenario: Filter out deferred servers (MODIFIED)
- **Given** the system calls `autoStartMCPServers()` at boot
- **When** fetching enabled servers
- **Then** only servers with `deferredStartup=false` or `deferredStartup=null` SHALL be included
- **And** servers with `deferredStartup=true` MUST be excluded from auto-start

---

## REMOVED Requirements

None.

---

## Related Capabilities

- MCP Server Management (existing)
- collect_feedback Tool (existing)
