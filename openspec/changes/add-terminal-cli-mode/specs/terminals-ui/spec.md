# Spec: Terminal List UI

## Overview

This spec defines the requirements for the Terminal List page UI that displays and manages CLI terminal instances.

---

## ADDED Requirements

### Requirement: Terminal List Page

A new page must be created to display CLI terminal instances.

#### Scenario: Display terminal list page

**Given** a user navigates to the Terminals page
**When** the page loads
**Then** the page should display:
  - Navigation bar (shared component)
  - Page title "Terminals"
  - List of terminal cards (or empty state message)
  - Auto-refresh status indicator

#### Scenario: Empty terminal list

**Given** no CLI terminals exist
**When** the Terminals page is loaded
**Then** an empty state message should be displayed
**And** the message should indicate "No active terminals"
**And** guidance to configure CLI mode in settings should be shown

---

### Requirement: Terminal Card Display

Each terminal must be displayed as a card with relevant information.

#### Scenario: Display terminal card

**Given** a CLI terminal exists
**When** the Terminals page is loaded
**Then** each terminal card should display:
  - Project name (prominent)
  - Project path (smaller text)
  - CLI tool name with icon (Gemini/Claude)
  - Status indicator (running/idle/error/stopped)
  - Last activity timestamp
  - Action buttons

#### Scenario: Status indicator colors

**Given** a terminal with a specific status
**When** the terminal card is displayed
**Then** the status indicator should show:
  - Green for "running" or "idle"
  - Yellow for "idle" (more than 5 minutes inactive)
  - Red for "error"
  - Gray for "stopped"

---

### Requirement: Terminal Actions

Users must be able to perform actions on terminals.

#### Scenario: View terminal logs

**Given** a user clicks "View Logs" on a terminal card
**When** the action is triggered
**Then** a modal should open
**And** display recent execution logs for that terminal
**And** logs should show: timestamp, prompt preview, response preview, success/failure

#### Scenario: Stop terminal

**Given** a user clicks "Stop" on an active terminal card
**When** the action is triggered
**Then** a confirmation dialog should appear
**And** upon confirmation, the terminal should be stopped
**And** the terminal card should update to "stopped" status

#### Scenario: Remove terminal

**Given** a user clicks "Remove" on a stopped terminal card
**When** the action is triggered
**Then** the terminal should be removed from the list
**And** associated logs should be cleaned up (optional)

---

### Requirement: Auto-Refresh

The terminal list must auto-refresh to show current status.

#### Scenario: Auto-refresh terminal list

**Given** the Terminals page is open
**When** 5 seconds have elapsed
**Then** the terminal list should refresh automatically
**And** terminal statuses should be updated
**And** new terminals should appear

#### Scenario: Pause auto-refresh on modal open

**Given** the execution logs modal is open
**When** the auto-refresh interval triggers
**Then** the main list should not refresh
**And** the modal content should remain stable

---

### Requirement: Terminal Log Viewer Modal

A modal must display execution logs for a selected terminal.

#### Scenario: Display log viewer modal

**Given** a user opens the log viewer for a terminal
**When** the modal is displayed
**Then** it should show:
  - Terminal info header (project name, tool)
  - List of execution logs (newest first)
  - Each log entry: timestamp, prompt, response, status
  - Close button

#### Scenario: Log entry details

**Given** an execution log entry is displayed
**When** the user views the entry
**Then** it should show:
  - Timestamp in readable format
  - Prompt text (truncated with expand option)
  - Response text (truncated with expand option)
  - Execution time in seconds
  - Success/failure indicator

#### Scenario: Empty logs

**Given** a terminal has no execution logs
**When** the log viewer modal is opened
**Then** a message should indicate "No execution logs yet"

---

### Requirement: Navigation Integration

The Terminals page must be accessible from the navigation bar.

#### Scenario: Navigation bar includes Terminals link

**Given** the navigation bar component
**When** the navigation bar is rendered
**Then** it should include a "Terminals" link
**And** the link should navigate to `/terminals.html`

#### Scenario: Active state on Terminals page

**Given** a user is on the Terminals page
**When** the navigation bar is rendered
**Then** the "Terminals" link should have active styling

---

### Requirement: Responsive Design

The terminal list page must be responsive.

#### Scenario: Desktop layout

**Given** screen width is 1024px or greater
**When** the Terminals page is displayed
**Then** terminal cards should be arranged in a grid (3-4 columns)

#### Scenario: Tablet layout

**Given** screen width is between 768px and 1023px
**When** the Terminals page is displayed
**Then** terminal cards should be arranged in 2 columns

#### Scenario: Mobile layout

**Given** screen width is less than 768px
**When** the Terminals page is displayed
**Then** terminal cards should stack vertically (1 column)

---

### Requirement: API Integration

The page must use API endpoints for data.

#### Scenario: Fetch terminals list

**Given** the Terminals page loads
**When** data is fetched
**Then** GET `/api/cli/terminals` should be called
**And** the response should populate the terminal list

#### Scenario: Fetch terminal logs

**Given** the user opens log viewer for a terminal
**When** logs are fetched
**Then** GET `/api/cli/terminals/:id/logs` should be called
**And** the response should populate the log list

#### Scenario: Delete terminal

**Given** the user removes a terminal
**When** the action is confirmed
**Then** DELETE `/api/cli/terminals/:id` should be called
**And** the terminal should be removed from the list

---

## Technical Notes

- Reuse project card styling from dashboard for consistency
- Use Socket.IO for real-time updates if available, fallback to polling
- Implement virtual scrolling if terminal list grows large
- Consider lazy loading for execution logs
