# Specification Delta: Prompt Management

## ADDED Requirements

### Requirement: Prompt CRUD Operations

The system SHALL provide full Create, Read, Update, Delete operations for user prompts.

#### Scenario: User Creates New Prompt

- **GIVEN** the user is viewing the prompt management panel
- **WHEN** the user clicks "Add New Prompt" button
- **THEN** a prompt creation form SHALL be displayed
- **AND** the form SHALL include fields for:
  - Title (required, max 100 characters)
  - Content (required, max 5,000 characters)
  - Category (optional, max 50 characters)
- **AND** after submission, the new prompt SHALL appear in the prompt list
- **AND** the creation SHALL persist to the database

#### Scenario: User Edits Existing Prompt

- **GIVEN** a prompt exists in the prompt list
- **WHEN** the user clicks the "Edit" button on the prompt
- **THEN** an edit form SHALL be displayed with current values pre-filled
- **AND** the user SHALL be able to modify title, content, and category
- **AND** after saving, the updated prompt SHALL replace the old version
- **AND** the update SHALL persist to the database

#### Scenario: User Deletes Prompt

- **GIVEN** a prompt exists in the prompt list
- **WHEN** the user clicks the "Delete" button
- **THEN** a confirmation dialog SHALL ask: "Delete this prompt?"
- **AND** if confirmed, the prompt SHALL be removed from the list
- **AND** the deletion SHALL persist to the database
- **AND** if the prompt was pinned, it SHALL also be unpinned

#### Scenario: User Views All Prompts

- **GIVEN** the user has created multiple prompts
- **WHEN** the prompt management panel is displayed
- **THEN** all prompts SHALL be listed with:
  - Title
  - Preview of content (first 50 characters)
  - Pin status indicator
  - Edit and delete buttons
- **AND** prompts SHALL be sorted with pinned prompts first
- **AND** within each group (pinned/unpinned), prompts SHALL be ordered by `order_index`

---

### Requirement: Prompt Pinning and Priority Ordering

The system SHALL allow users to pin prompts for quick access and auto-loading.

#### Scenario: User Pins a Prompt

- **GIVEN** an unpinned prompt exists in the list
- **WHEN** the user clicks the "Pin" button
- **THEN** the prompt SHALL be marked as pinned
- **AND** the prompt SHALL move to the top of the list (pinned section)
- **AND** the pin status SHALL persist to the database
- **AND** the pinned prompt SHALL have a visual indicator (e.g., pin icon)

#### Scenario: User Unpins a Prompt

- **GIVEN** a pinned prompt exists in the list
- **WHEN** the user clicks the "Unpin" button
- **THEN** the prompt SHALL be marked as unpinned
- **AND** the prompt SHALL move to the unpinned section of the list
- **AND** the pin status SHALL persist to the database

#### Scenario: User Reorders Pinned Prompts

- **GIVEN** multiple pinned prompts exist
- **WHEN** the user drags a pinned prompt to a new position (if drag-drop implemented)
- **OR** uses up/down arrow buttons to adjust order
- **THEN** the prompt's `order_index` SHALL be updated
- **AND** the new order SHALL be reflected in the list immediately
- **AND** the new order SHALL persist to the database

#### Scenario: Pinned Prompts Auto-Load on Startup

- **GIVEN** the user has pinned prompts with specific order
- **WHEN** the feedback interface loads
- **THEN** all pinned prompts' content SHALL be loaded in order
- **AND** the content SHALL be concatenated with double newlines (`\n\n`)
- **AND** the concatenated content SHALL be inserted into the text input area
- **AND** the user SHALL be able to edit or clear the auto-loaded content

---

### Requirement: Prompt Search and Filtering

The system SHALL provide search functionality to quickly find prompts.

#### Scenario: User Searches Prompts by Title

- **GIVEN** the prompt list contains multiple prompts
- **WHEN** the user types in the search box
- **THEN** the prompt list SHALL filter in real-time
- **AND** only prompts with matching titles SHALL be displayed
- **AND** the search SHALL be case-insensitive
- **AND** partial matches SHALL be supported

#### Scenario: User Searches Prompts by Content

- **GIVEN** the prompt list contains multiple prompts
- **WHEN** the user types in the search box
- **THEN** the prompt list SHALL filter by both title and content
- **AND** prompts with matching content (even if title doesn't match) SHALL be displayed
- **AND** the search results SHALL be highlighted

#### Scenario: User Clears Search

- **GIVEN** the user has entered a search query
- **WHEN** the user clears the search box
- **THEN** all prompts SHALL be displayed again
- **AND** the original sort order SHALL be restored

---

### Requirement: Prompt Click to Copy

The system SHALL allow users to insert prompt content into the input area with a single click.

#### Scenario: User Clicks Prompt to Insert

- **GIVEN** a prompt is displayed in the prompt list
- **WHEN** the user clicks on the prompt
- **THEN** the prompt's content SHALL be copied to the text input area
- **AND** if the input area already has content, a confirmation dialog SHALL ask: "Replace or append?"
- **AND** if "Replace" is selected, the existing text SHALL be replaced
- **AND** if "Append" is selected, the prompt content SHALL be appended with a newline separator

#### Scenario: User Copies Prompt Content to Clipboard

- **GIVEN** a prompt is displayed with a "Copy" button
- **WHEN** the user clicks the "Copy" button
- **THEN** the prompt's content SHALL be copied to the system clipboard
- **AND** a visual confirmation SHALL be shown (e.g., "Copied!" tooltip)
- **AND** the clipboard operation SHALL complete within 500ms

---

### Requirement: Prompt Categories and Organization

The system SHALL support optional categorization of prompts for better organization.

#### Scenario: User Assigns Category to Prompt

- **GIVEN** the user is creating or editing a prompt
- **WHEN** the user enters a category name
- **THEN** the prompt SHALL be tagged with that category
- **AND** the category SHALL be stored in the database
- **AND** the category SHALL be displayed as a badge on the prompt

#### Scenario: User Filters Prompts by Category

- **GIVEN** prompts exist with different categories
- **WHEN** the user selects a category from the filter dropdown
- **THEN** only prompts with that category SHALL be displayed
- **AND** the "All" option SHALL show all prompts regardless of category

#### Scenario: User Views Uncategorized Prompts

- **GIVEN** some prompts have no category assigned
- **WHEN** the user selects "Uncategorized" from the filter
- **THEN** only prompts without a category SHALL be displayed

---

### Requirement: Prompt Import and Export

The system SHALL allow users to import and export prompt collections.

#### Scenario: User Exports Prompts to JSON

- **GIVEN** the user has created prompts
- **WHEN** the user clicks "Export Prompts" button
- **THEN** a JSON file SHALL be generated with all prompts
- **AND** the JSON SHALL include: id, title, content, isPinned, order, category
- **AND** the file SHALL be downloaded with filename: `prompts_YYYYMMDD_HHMMSS.json`

#### Scenario: User Imports Prompts from JSON

- **GIVEN** the user has a valid prompts JSON file
- **WHEN** the user clicks "Import Prompts" and selects the file
- **THEN** the system SHALL validate the JSON structure
- **AND** if valid, the prompts SHALL be imported into the database
- **AND** if a prompt with the same title exists, the user SHALL be asked: "Skip, Replace, or Rename?"
- **AND** a summary SHALL be shown: "X prompts imported, Y skipped, Z errors"

#### Scenario: User Imports Invalid JSON File

- **GIVEN** the user selects an invalid JSON file for import
- **WHEN** the import process runs
- **THEN** an error message SHALL be displayed: "Invalid file format"
- **AND** no prompts SHALL be imported
- **AND** the existing prompts SHALL remain unchanged

---

### Requirement: Prompt Validation

The system SHALL validate prompt data to ensure data integrity.

#### Scenario: User Attempts to Create Prompt with Empty Title

- **GIVEN** the user is creating a new prompt
- **WHEN** the user leaves the title field empty and submits
- **THEN** an error message SHALL be displayed: "Title is required"
- **AND** the form SHALL not submit
- **AND** the title field SHALL be highlighted

#### Scenario: User Attempts to Create Prompt with Excessively Long Content

- **GIVEN** the user is creating a new prompt
- **WHEN** the user enters content exceeding 5,000 characters
- **THEN** a warning message SHALL be displayed: "Content exceeds maximum length (5,000 characters)"
- **AND** the submit button SHALL be disabled
- **AND** the character count SHALL be displayed

#### Scenario: User Attempts to Create Duplicate Prompt Title

- **GIVEN** a prompt with title "Daily Standup" already exists
- **WHEN** the user attempts to create another prompt with the same title
- **THEN** a warning message SHALL be displayed: "A prompt with this title already exists"
- **AND** the user SHALL be asked: "Create with different title or cancel?"

---

## MODIFIED Requirements

None (this is a new capability).

---

## REMOVED Requirements

None (this is a new capability).
