# Design: Persist API Response Time Setting Across Sessions

## Architecture Overview

### Current Flow (Broken)
```
Frontend Settings Modal
  ↓ (POST /api/ai-settings with autoReplyTimerSeconds)
Backend Receives Update
  ↓ (Data goes nowhere - no DB column)
Next Session Starts
  ↓ (Loads from DB)
Frontend Gets Default (300s)
```

### Proposed Flow (Fixed)
```
Frontend Settings Modal
  ↓ (POST /api/ai-settings with autoReplyTimerSeconds)
Backend Receives Update
  ↓ (Saves to ai_settings.auto_reply_timer_seconds)
Database Persists
  ↓ (On next session)
Backend Loads from DB
  ↓ (Returns in /api/ai-settings response)
Frontend Applies Saved Value
  ↓
User Sees Their Configured Timeout
```

## Data Model Changes

### Database Schema Change
Add new column to `ai_settings` table:
```sql
ALTER TABLE ai_settings ADD COLUMN auto_reply_timer_seconds INTEGER DEFAULT 300;
```

**Rationale for placement in `ai_settings`**:
- The auto-reply timer is part of AI behavioral configuration
- It affects how the AI system responds to user feedback
- Keeps AI-related settings in one logical table
- Simpler than adding to `user_preferences` which is for UI/UX preferences

### Type System Changes
- Update `AISettings` interface to include `autoReplyTimerSeconds?: number`
- Update `AISettingsRequest` interface to include `autoReplyTimerSeconds?: number`
- Update `AISettingsResponse` interface to include `autoReplyTimerSeconds?: number`

## Implementation Strategy

### Phase 1: Database Layer
1. Add `auto_reply_timer_seconds` column to schema
2. Handle backward compatibility for existing databases via migration check
3. Set default to 300 seconds for existing records

### Phase 2: Type System
1. Update TypeScript interfaces with new field
2. Ensure type safety in all usages

### Phase 3: Backend API
1. Update `updateAISettings()` to handle the new field
2. Update `getAISettings()` to return the new field  
3. Update `/api/ai-settings` endpoint (GET/PUT) to include the field

### Phase 4: Frontend
1. Update settings modal to send field on save
2. Update `loadAISettings()` to receive and apply the value
3. Verify AUTO_REPLY_TIMER_SECONDS global is set from loaded value

## Data Flow Specifications

### Save Flow
```typescript
// Frontend (app.js)
autoReplyTimerSeconds = parseInt(document.getElementById("autoReplyTimerSeconds").value)
settingsData.autoReplyTimerSeconds = autoReplyTimerSeconds
// POST /api/ai-settings with settingsData

// Backend (web-server.ts)
const result = updateAISettings(settingsData)
response.json({ success: true, settings: result })

// Database (database.ts)
// UPDATE ai_settings SET auto_reply_timer_seconds = ? WHERE id = ?
```

### Load Flow
```typescript
// Frontend (app.js)
// GET /api/ai-settings
aiSettings = data.settings
AUTO_REPLY_TIMER_SECONDS = aiSettings.autoReplyTimerSeconds || 300

// Backend (web-server.ts)
const aiSettings = getAISettings()
response.json({ success: true, settings: aiSettings })

// Database (database.ts)
// SELECT auto_reply_timer_seconds FROM ai_settings LIMIT 1
```

## Validation Rules

### Valid Range
- Minimum: 30 seconds (enough time for user response)
- Maximum: 600 seconds (10 minutes reasonable limit)
- Default: 300 seconds

### Validation Point
- Frontend: HTML5 `min="30" max="600"` attributes
- Backend: Validate in API endpoint (optional but recommended)

## Migration Strategy

### For Existing Databases
1. Check if column exists on app startup
2. If missing, run ALTER TABLE to add column
3. Set default value of 300 for all existing records
4. No data loss, backward compatible

### For New Installations
1. Column created automatically via `createTables()` function
2. Populated with default 300 during initialization

## Testing Scenarios

### Scenario 1: Save and Persist
1. User opens settings, changes timeout to 120 seconds
2. Clicks Save
3. Application restarts
4. User opens settings again
5. Timeout shows as 120 seconds ✓

### Scenario 2: Default Fallback
1. Fresh installation (no value in DB)
2. Application loads
3. AUTO_REPLY_TIMER_SECONDS defaults to 300 ✓

### Scenario 3: Multiple Users/Sessions
1. User A sets timeout to 100 seconds
2. User B opens settings
3. User B sees value 100 seconds (shared global setting) ✓

## Backward Compatibility

- ✅ Existing databases: Auto-migrated via ALTER TABLE check
- ✅ Old frontend: Still works, just doesn't save/load the value
- ✅ Old backend: Still works, ignores new field if not present
- ✅ Type system: Field is optional (`?`), graceful degradation

## Error Handling

### Edge Cases
1. **Database column missing**: Auto-migrate on startup
2. **Invalid/corrupted value**: Fall back to 300
3. **Out of range**: Clamp to valid range in backend validation
4. **Missing response field**: Frontend uses 300 default

## Performance Considerations

- **Query Impact**: Minimal - reads from cached `ai_settings` once per session
- **Storage**: 4 bytes (INTEGER type) per record
- **Network**: Included in existing `/api/ai-settings` call, no additional overhead
