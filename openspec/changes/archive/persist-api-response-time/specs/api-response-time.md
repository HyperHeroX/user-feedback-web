# Specification: API Response Time Persistence

## Overview
This specification defines the requirements for persisting the API response time (auto-reply timeout) setting across application sessions.

## ADDED Requirements

### Requirement: Database Column for Auto-Reply Timer
**Identifier**: `api-response-time-db-column`

The system SHALL add an `auto_reply_timer_seconds` column to the `ai_settings` table to persist the auto-reply timeout value.

**Details**:
- Column name: `auto_reply_timer_seconds`
- Column type: INTEGER
- Default value: 300
- Nullable: No
- Scope: Database schema in `src/utils/database.ts`

#### Scenario: New Database Installation
When the application initializes for the first time, the `ai_settings` table SHALL include the `auto_reply_timer_seconds` column with default value of 300.

```typescript
// In createTables() function
db.exec(`
  CREATE TABLE IF NOT EXISTS ai_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_url TEXT NOT NULL,
    model TEXT NOT NULL,
    api_key TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    temperature REAL,
    max_tokens INTEGER,
    auto_reply_timer_seconds INTEGER DEFAULT 300,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);
```

#### Scenario: Existing Database Migration
When the application starts with an existing database that lacks the `auto_reply_timer_seconds` column, the system SHALL automatically add it with a default value of 300 seconds.

```typescript
// In createTables() or initDatabase()
// Check if column exists, if not add it via ALTER TABLE
```

---

### Requirement: Update AISettings Type Definition
**Identifier**: `api-response-time-type-definition`

The `AISettings` and related interfaces SHALL include the `autoReplyTimerSeconds` field to represent the persistent auto-reply timeout value.

**Details**:
- Add field to `AISettings` interface: `autoReplyTimerSeconds?: number`
- Add field to `AISettingsRequest` interface: `autoReplyTimerSeconds?: number`
- Add field to `AISettingsResponse` interface: `autoReplyTimerSeconds?: number`
- Field is optional to support backward compatibility

#### Scenario: Type Safety
A TypeScript application consuming the AISettings type SHALL be able to access the `autoReplyTimerSeconds` property without errors.

```typescript
interface AISettings {
  id: number;
  apiUrl: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  autoReplyTimerSeconds?: number;  // NEW FIELD
  createdAt: string;
  updatedAt: string;
}
```

---

### Requirement: Database Read Operation
**Identifier**: `api-response-time-db-read`

The `getAISettings()` function SHALL retrieve the `auto_reply_timer_seconds` value from the database and include it in the returned `AISettings` object.

**Details**:
- Function: `getAISettings()` in `src/utils/database.ts`
- SQL query must include: `auto_reply_timer_seconds as autoReplyTimerSeconds`
- Return value includes the field

#### Scenario: Load Persisted Setting
When the application loads AI settings, the previously saved auto-reply timeout SHALL be included in the response.

```typescript
export function getAISettings(): AISettings | undefined {
  const row = db.prepare(`
    SELECT 
      id, api_url as apiUrl, model, api_key as apiKey, 
      system_prompt as systemPrompt,
      temperature, max_tokens as maxTokens,
      auto_reply_timer_seconds as autoReplyTimerSeconds,
      created_at as createdAt, updated_at as updatedAt
    FROM ai_settings
    ORDER BY id DESC
    LIMIT 1
  `).get();
  // ...
  return settings as AISettings;
}
```

---

### Requirement: Database Write Operation
**Identifier**: `api-response-time-db-write`

The `updateAISettings()` function SHALL persist the `autoReplyTimerSeconds` value to the database when provided in the update request.

**Details**:
- Function: `updateAISettings(data: AISettingsRequest)` in `src/utils/database.ts`
- When `data.autoReplyTimerSeconds` is provided, update `auto_reply_timer_seconds` column
- Update must set `updated_at` to current timestamp
- Return the updated `AISettings` object

#### Scenario: Save User Configuration
When a user updates the auto-reply timeout through the settings interface, the value SHALL be saved to the database.

```typescript
export function updateAISettings(data: AISettingsRequest): AISettings {
  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];

    // ... existing updates ...

    if (data.autoReplyTimerSeconds !== undefined) {
      updates.push('auto_reply_timer_seconds = ?');
      values.push(data.autoReplyTimerSeconds);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(existing.id);
      db.prepare(`UPDATE ai_settings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
  }
  return getAISettings()!;
}
```

---

### Requirement: API Endpoint Returns Auto-Reply Timer
**Identifier**: `api-response-time-api-endpoint`

The `GET /api/ai-settings` endpoint SHALL return the `autoReplyTimerSeconds` value in the settings response.

**Details**:
- Endpoint: `GET /api/ai-settings`
- Response includes `settings.autoReplyTimerSeconds` if available
- If not available, frontend defaults to 300

#### Scenario: API Response Includes Setting
When the frontend requests current AI settings, the response SHALL include the auto-reply timer value.

```javascript
// Frontend request
const response = await fetch("/api/ai-settings");
const data = await response.json();
// Response: { success: true, settings: { ..., autoReplyTimerSeconds: 120, ... } }
```

---

### Requirement: API Endpoint Accepts Auto-Reply Timer Update
**Identifier**: `api-response-time-api-update`

The `PUT /api/ai-settings` endpoint SHALL accept and persist `autoReplyTimerSeconds` in the update request.

**Details**:
- Endpoint: `PUT /api/ai-settings`
- Request body includes `autoReplyTimerSeconds` as integer
- Response returns updated settings with new value
- Validation: Value must be between 30 and 600 seconds

#### Scenario: Save Auto-Reply Timer via API
When the frontend submits settings with an auto-reply timeout, the backend SHALL save it and return the updated settings.

```javascript
// Frontend request
const response = await fetch("/api/ai-settings", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ autoReplyTimerSeconds: 120 })
});
// Response: { success: true, settings: { ..., autoReplyTimerSeconds: 120, ... } }
```

---

### Requirement: Frontend Loads and Applies Setting
**Identifier**: `api-response-time-frontend-load`

The frontend `loadAISettings()` function SHALL retrieve the saved `autoReplyTimerSeconds` value and apply it to the `AUTO_REPLY_TIMER_SECONDS` global variable for use in the current session.

**Details**:
- Function: `loadAISettings()` in `src/static/app.js`
- If API response includes `autoReplyTimerSeconds`, assign to global variable
- If not present or undefined, use default 300
- Log the value for debugging

#### Scenario: Session Startup Applies Saved Setting
When the application starts and loads AI settings, the user's previously configured auto-reply timeout SHALL be applied for the current session.

```javascript
async function loadAISettings() {
  try {
    const response = await fetch("/api/ai-settings");
    const data = await response.json();

    if (data.success) {
      aiSettings = data.settings;
      
      if (aiSettings.autoReplyTimerSeconds !== undefined) {
        AUTO_REPLY_TIMER_SECONDS = aiSettings.autoReplyTimerSeconds;
        console.log(`Auto-reply timeout set to: ${AUTO_REPLY_TIMER_SECONDS}s`);
      }
    }
  } catch (error) {
    console.error("Failed to load AI settings:", error);
  }
}
```

---

### Requirement: Settings Modal Displays Saved Value
**Identifier**: `api-response-time-frontend-display`

The settings modal `openAISettingsModal()` function SHALL display the currently saved `autoReplyTimerSeconds` value in the input field.

**Details**:
- Function: `openAISettingsModal()` in `src/static/app.js`
- Input element ID: `autoReplyTimerSeconds`
- Display the saved value or default 300 if not present

#### Scenario: User Opens Settings to Check Configuration
When the user opens the settings modal, the auto-reply timeout input field SHALL display the currently saved value.

```javascript
function openAISettingsModal() {
  if (aiSettings) {
    document.getElementById("autoReplyTimerSeconds").value = 
      aiSettings.autoReplyTimerSeconds || 300;
  }
  document.getElementById("aiSettingsModal").classList.add("show");
}
```

---

### Requirement: Settings Modal Sends Auto-Reply Timer on Save
**Identifier**: `api-response-time-frontend-save`

The `saveAISettings()` function SHALL read the `autoReplyTimerSeconds` input value and include it in the API update request.

**Details**:
- Function: `saveAISettings()` in `src/static/app.js`
- Read from input element: `document.getElementById("autoReplyTimerSeconds").value`
- Parse as integer
- Include in POST/PUT request to `/api/ai-settings`
- Validate range: 30-600 seconds

#### Scenario: User Saves Updated Auto-Reply Timeout
When the user modifies the auto-reply timeout in settings and clicks Save, the new value SHALL be sent to the backend for persistence.

```javascript
async function saveAISettings() {
  const autoReplyTimerSeconds = parseInt(document.getElementById("autoReplyTimerSeconds").value);
  
  const settingsData = {
    // ... other fields ...
    autoReplyTimerSeconds
  };

  const response = await fetch("/api/ai-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settingsData)
  });
  
  // ... handle response ...
}
```

---

## MODIFIED Requirements

### Requirement: Update Database Default Initialization
**Identifier**: `api-response-time-init-default`

The `initDefaultSettings()` function SHALL initialize new `ai_settings` records with a default `auto_reply_timer_seconds` value of 300 seconds.

**Details**:
- When inserting default AI settings on first run, set `auto_reply_timer_seconds` to 300
- This ensures all new installations have a valid default value

#### Scenario: Fresh Installation Default Value
When the application runs for the first time and initializes default settings, the auto-reply timeout SHALL be set to 300 seconds in the database.

---

## REMOVED Requirements
None

## Validation & Testing

### Unit Test: Database Column Exists
Verify that the `auto_reply_timer_seconds` column exists in `ai_settings` table after initialization.

### Unit Test: Read/Write Operations
Test that `getAISettings()` correctly reads the value and `updateAISettings()` correctly persists the value.

### Integration Test: End-to-End Persistence
1. Set auto-reply timeout to 120 seconds via settings modal
2. Save settings
3. Simulate application restart (reload in browser, new session)
4. Load AI settings
5. Verify AUTO_REPLY_TIMER_SECONDS = 120
6. Open settings modal and verify input shows 120

### Integration Test: Default Fallback
1. Fresh installation
2. Load AI settings without setting auto-reply timeout
3. Verify AUTO_REPLY_TIMER_SECONDS defaults to 300
