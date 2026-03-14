# Proposal: Persist API Response Time Setting Across Sessions

## Summary
The API response time (autoReplyTimerSeconds) setting configured in the settings page is not persisted to the database and therefore is not applied on the next session startup. This proposal fixes the persistence mechanism so that users' configured auto-reply timeout values are preserved across application restarts.

## Problem Statement
**Current Issue**: 
- Users can set "自動 AI 回覆時間（秒）" (Auto AI Reply Time) in the settings modal
- This value is sent to the backend via `/api/ai-settings` endpoint
- However, the value is never actually stored in the database
- On the next session, the application reverts to the default 300 seconds

**Expected Behavior**:
- When a user configures the API response time in settings, it should be persisted
- On the next session/startup, the saved value should be automatically applied
- The setting should remain effective until explicitly changed

**Root Cause**:
The `ai_settings` database table lacks an `auto_reply_timer_seconds` column to store this value. The backend accepts the setting but has nowhere to persist it.

## Scope
- Add `auto_reply_timer_seconds` column to `ai_settings` table
- Update `AISettings` and `AISettingsRequest` types to include the field
- Update database functions (`getAISettings`, `updateAISettings`) to handle the new column
- Update web server API endpoints to include/return this field
- Ensure frontend properly loads and applies the value on session startup

## Dependencies
- None (self-contained feature)

## Success Criteria
1. ✅ Users can configure auto-reply timeout in settings page
2. ✅ Value is persisted to `ai_settings` table in database
3. ✅ Value is loaded and applied automatically on session startup
4. ✅ Setting persists across application restarts
5. ✅ Default value (300 seconds) is used if not configured

## Related Issues/Changes
- Affects: Settings persistence behavior
- Depends on: Database schema, Type definitions, API endpoints
