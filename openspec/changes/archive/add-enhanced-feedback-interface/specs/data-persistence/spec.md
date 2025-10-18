# Specification Delta: Data Persistence

## ADDED Requirements

### Requirement: SQLite Database Initialization

The system SHALL initialize a SQLite database for persistent data storage.

#### Scenario: First-Time Database Creation

- **GIVEN** the application is started for the first time
- **AND** no database file exists
- **WHEN** the database module initializes
- **THEN** a SQLite database file SHALL be created at `data/feedback.db`
- **AND** all required tables SHALL be created:
  - `prompts` (id, title, content, is_pinned, order_index, category, created_at, updated_at)
  - `ai_settings` (id, api_url, model, api_key_encrypted, system_prompt, created_at, updated_at)
  - `user_preferences` (id, key, value, created_at, updated_at)
- **AND** indexes SHALL be created for frequently queried columns
- **AND** the initialization SHALL complete within 1 second

#### Scenario: Database Already Exists

- **GIVEN** the application is started
- **AND** a database file already exists
- **WHEN** the database module initializes
- **THEN** the existing database SHALL be opened
- **AND** a version check SHALL be performed
- **AND** if schema migration is needed, it SHALL be executed
- **AND** the initialization SHALL complete within 500ms

#### Scenario: Database File is Corrupted

- **GIVEN** the database file exists but is corrupted
- **WHEN** the database module attempts to initialize
- **THEN** an error SHALL be detected
- **AND** the corrupted file SHALL be backed up to `data/feedback.db.corrupt.TIMESTAMP`
- **AND** a new clean database SHALL be created
- **AND** a warning SHALL be logged: "Database corrupted, created new database"

---

### Requirement: Prompts Table Schema

The system SHALL store prompts in a structured table with appropriate constraints.

**Table Schema**:
```sql
CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,  -- Boolean: 0=false, 1=true
  order_index INTEGER NOT NULL DEFAULT 0,
  category TEXT DEFAULT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prompts_pinned_order ON prompts(is_pinned DESC, order_index ASC);
CREATE INDEX idx_prompts_category ON prompts(category);
```

#### Scenario: Insert New Prompt into Database

- **GIVEN** a user creates a new prompt
- **WHEN** the prompt data is inserted
- **THEN** the prompt SHALL be assigned a unique auto-increment ID
- **AND** `created_at` and `updated_at` SHALL be set to current timestamp
- **AND** `is_pinned` SHALL default to 0 (false)
- **AND** `order_index` SHALL default to 0
- **AND** the insert SHALL complete within 100ms

#### Scenario: Update Prompt in Database

- **GIVEN** a prompt exists in the database
- **WHEN** the prompt is updated
- **THEN** the `updated_at` field SHALL be updated to current timestamp
- **AND** all modified fields SHALL be saved
- **AND** the update SHALL complete within 100ms

#### Scenario: Query Prompts with Pinned First

- **GIVEN** multiple prompts exist (some pinned, some not)
- **WHEN** prompts are queried
- **THEN** the results SHALL be sorted by:
  1. `is_pinned DESC` (pinned first)
  2. `order_index ASC` (custom order within each group)
- **AND** the query SHALL complete within 50ms

---

### Requirement: AI Settings Table Schema

The system SHALL store AI configuration in a dedicated table with encrypted API keys.

**Table Schema**:
```sql
CREATE TABLE ai_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_url TEXT NOT NULL DEFAULT 'https://generativelanguage.googleapis.com/v1beta',
  model TEXT NOT NULL DEFAULT 'gemini-2.0-flash-exp',
  api_key_encrypted TEXT DEFAULT NULL,  -- Encrypted with AES-256-GCM
  system_prompt TEXT DEFAULT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

#### Scenario: Store Encrypted API Key

- **GIVEN** the user saves AI settings with an API key
- **WHEN** the data is persisted
- **THEN** the API key SHALL be encrypted before storage
- **AND** the encrypted value format SHALL be: `{iv}:{authTag}:{encryptedData}` (all hex-encoded)
- **AND** the plain-text API key SHALL never be stored
- **AND** the storage SHALL complete within 200ms

#### Scenario: Retrieve and Decrypt API Key

- **GIVEN** encrypted AI settings exist in the database
- **WHEN** the system needs to use the API key
- **THEN** the encrypted value SHALL be retrieved from database
- **AND** the value SHALL be decrypted using the master encryption key
- **AND** the plain-text API key SHALL be returned (in memory only)
- **AND** the decryption SHALL complete within 100ms

#### Scenario: Update AI Settings

- **GIVEN** existing AI settings are stored
- **WHEN** the user updates the settings
- **THEN** the `updated_at` field SHALL be updated
- **AND** if API key is changed, the new key SHALL be re-encrypted
- **AND** the update SHALL complete within 200ms

---

### Requirement: User Preferences Table Schema

The system SHALL store user preferences as key-value pairs.

**Table Schema**:
```sql
CREATE TABLE user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_preferences_key ON user_preferences(key);
```

#### Scenario: Store User Preference

- **GIVEN** a user preference needs to be saved (e.g., `auto_reply_timeout: 300`)
- **WHEN** the preference is stored
- **THEN** if the key already exists, the value SHALL be updated
- **AND** if the key doesn't exist, a new row SHALL be inserted
- **AND** the operation SHALL use UPSERT (INSERT OR REPLACE)
- **AND** the operation SHALL complete within 100ms

#### Scenario: Retrieve User Preference

- **GIVEN** a user preference is stored
- **WHEN** the preference is retrieved by key
- **THEN** the corresponding value SHALL be returned
- **AND** if the key doesn't exist, `NULL` or default value SHALL be returned
- **AND** the retrieval SHALL complete within 50ms

---

### Requirement: Database Transactions

The system SHALL use database transactions to ensure data consistency.

#### Scenario: Atomic Prompt Update

- **GIVEN** a prompt update operation involves multiple table changes
- **WHEN** the update is executed
- **THEN** all changes SHALL be wrapped in a transaction
- **AND** if any operation fails, all changes SHALL be rolled back
- **AND** if all operations succeed, the transaction SHALL be committed
- **AND** data consistency SHALL be guaranteed

#### Scenario: Transaction Rollback on Error

- **GIVEN** a database operation is in progress
- **WHEN** an error occurs mid-transaction (e.g., constraint violation)
- **THEN** the transaction SHALL be rolled back automatically
- **AND** the database SHALL remain in a consistent state
- **AND** an error SHALL be returned to the caller

---

### Requirement: Database Migration System

The system SHALL support schema migrations for database version upgrades.

#### Scenario: Detect Schema Version Mismatch

- **GIVEN** the application code expects schema version 2
- **AND** the database is at schema version 1
- **WHEN** the database module initializes
- **THEN** the version mismatch SHALL be detected
- **AND** migration scripts SHALL be executed in order (v1→v2)
- **AND** the schema version SHALL be updated in the database
- **AND** the migration SHALL complete before application starts

#### Scenario: Apply Migration Script

- **GIVEN** a migration script needs to be applied (e.g., add new column)
- **WHEN** the migration executes
- **THEN** the script SHALL run within a transaction
- **AND** if successful, the migration SHALL be marked as applied
- **AND** if failed, the transaction SHALL rollback and error SHALL be logged
- **AND** the application SHALL not start until migration succeeds

#### Scenario: Skip Already Applied Migrations

- **GIVEN** migration v1→v2 has already been applied
- **WHEN** the database initializes again
- **THEN** the already-applied migration SHALL be skipped
- **AND** only newer migrations (if any) SHALL be executed

---

### Requirement: Database Backup and Restore

The system SHALL provide automatic database backup functionality.

#### Scenario: Automatic Daily Backup

- **GIVEN** the application is running
- **WHEN** the daily backup time is reached (e.g., 2:00 AM)
- **THEN** the database SHALL be backed up to `data/backups/feedback_YYYYMMDD.db`
- **AND** the backup SHALL be a full copy of the database
- **AND** backups older than 7 days SHALL be automatically deleted
- **AND** the backup process SHALL not block normal operations

#### Scenario: Manual Backup Triggered

- **GIVEN** the user triggers a manual backup (via API or CLI)
- **WHEN** the backup command is executed
- **THEN** an immediate backup SHALL be created
- **AND** the backup file SHALL be named: `feedback_manual_YYYYMMDD_HHMMSS.db`
- **AND** the backup SHALL complete within 5 seconds

#### Scenario: Restore Database from Backup

- **GIVEN** a backup file exists at `data/backups/feedback_YYYYMMDD.db`
- **WHEN** the user triggers a restore operation
- **THEN** the current database SHALL be backed up first (to `feedback.db.before_restore.TIMESTAMP`)
- **AND** the backup file SHALL replace the current database
- **AND** the application SHALL restart to load the restored database
- **AND** a success message SHALL be logged

---

### Requirement: Database Query Performance

The system SHALL optimize database queries for fast data retrieval.

#### Scenario: Query All Prompts

- **GIVEN** the database contains 100 prompts
- **WHEN** the prompt list is requested
- **THEN** the query SHALL complete within 50ms
- **AND** the result SHALL be sorted by pinned status and order
- **AND** the query SHALL use the `idx_prompts_pinned_order` index

#### Scenario: Search Prompts by Title or Content

- **GIVEN** the database contains 100 prompts
- **WHEN** the user searches for a keyword
- **THEN** the query SHALL use `LIKE` with wildcards
- **AND** the query SHALL search both title and content columns
- **AND** the query SHALL complete within 100ms

#### Scenario: Query with Large Dataset

- **GIVEN** the database contains 1,000 prompts
- **WHEN** any query is executed
- **THEN** the query SHALL still complete within 200ms
- **AND** pagination SHALL be used if displaying results (limit 50 per page)

---

### Requirement: Data Validation and Constraints

The system SHALL enforce data constraints at the database level.

#### Scenario: Enforce NOT NULL Constraint

- **GIVEN** a prompt insert/update operation
- **WHEN** a required field (title, content) is NULL or empty
- **THEN** the database SHALL reject the operation
- **AND** a constraint violation error SHALL be returned
- **AND** the caller SHALL handle the error gracefully

#### Scenario: Enforce Unique Key Constraint

- **GIVEN** a user preference with key "theme" already exists
- **WHEN** an attempt is made to insert another preference with key "theme"
- **THEN** the database SHALL use UPSERT behavior (replace existing)
- **AND** the operation SHALL succeed with the new value

---

### Requirement: Data Export and Import

The system SHALL allow exporting and importing data in JSON format.

#### Scenario: Export All Prompts to JSON

- **GIVEN** the user triggers a data export
- **WHEN** the export operation executes
- **THEN** all prompts SHALL be queried from database
- **AND** the data SHALL be serialized to JSON format
- **AND** the JSON SHALL include: id, title, content, isPinned, orderIndex, category
- **AND** the export SHALL complete within 2 seconds

#### Scenario: Import Prompts from JSON

- **GIVEN** the user provides a valid JSON file with prompts
- **WHEN** the import operation executes
- **THEN** each prompt SHALL be validated before insertion
- **AND** valid prompts SHALL be inserted into the database
- **AND** duplicate handling SHALL be configurable (skip, replace, rename)
- **AND** a summary SHALL be returned: "X imported, Y skipped, Z errors"

---

## MODIFIED Requirements

None (this is a new capability).

---

## REMOVED Requirements

None (this is a new capability).
