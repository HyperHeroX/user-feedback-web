# Design: Feedback Submission and AI Auto-Reply Enhancement

## Architectural Overview

This change modifies the feedback submission workflow and AI auto-reply behavior with three tightly coupled enhancements:

### 1. Selective Input Reset Strategy

**Current Behavior**:

- `clearInputs()` clears text, images, and char count
- No distinction between input types

**Proposed Behavior**:

- Create `clearSubmissionInputs()` (clear text, images, char count, description)
- Preserve prompt-related state and any cached prompt configurations
- Triggered on successful submission

**Technical Decision**:

- Separate concerns: submission inputs vs. prompt state management
- Allows users to reuse prompts without re-loading them

### 2. Auto-Reply Confirmation Timeout Flow

**Current Behavior**:

- `auto_reply_triggered` event fills text directly
- No user review step

**Proposed Flow**:

1. `auto_reply_triggered` event received from server
2. Display confirmation modal with 10-second countdown
3. User can accept or cancel
4. On timeout or accept → auto-submit with `clearSubmissionInputs()`
5. On error during submission → keep page open per requirement 1.2
6. On success → close page after 3 seconds

**Technical Decision**:

- Use countdown timer with visual feedback
- Keep existing Socket.IO event structure
- Leverage existing confirmation modal infrastructure

### 3. Prompt Settings in AI Configuration

**Current Behavior**:

- Separate "提示詞" panel on right side
- AI Settings modal has no direct prompt access

**Proposed Enhancement**:

- Add "編輯提示詞" button in AI Settings modal footer
- Clicking opens existing `promptModal` for add/edit
- Allows user context switching: AI settings → quick prompt management

**Technical Decision**:

- Reuse existing `promptModal` component
- No new modal needed
- Button placement in modal footer for logical flow

## State Management

```javascript
// New/Modified Global State
let autoReplyConfirmationTimeout = null;  // Track confirmation countdown
let autoReplyData = null;  // Store pending auto-reply before confirmation
```

## Event Flow Diagram

```text
User submits feedback
    ↓
[feedback_submitted event]
    ├─ Has error? → Show error, keep page open
    └─ No error?
        ├─ clearSubmissionInputs() (text, images, desc)
        ├─ Reset char count
        ├─ Keep prompts & AI settings
        └─ Close page after 3 seconds

Auto-reply triggered
    ↓
[auto_reply_triggered event]
    ├─ Store reply data
    ├─ Show confirmation modal (10-second countdown)
    ├─ Countdown reaches 0? OR user clicks accept?
    │   └─ Fill textarea + auto-submit feedback
    │       └─ Same success/error flow as above
    └─ User clicks cancel?
        └─ Clear confirmation modal, keep page open
```

## Backward Compatibility

- Existing Socket.IO events unchanged
- New timer functions internal to frontend
- No API contract changes

## Testing Strategy

1. **Unit Tests**:
   - `clearSubmissionInputs()` correctly preserves prompt state
   - Countdown timer accuracy (10 seconds)
   - Modal dismiss on timeout

2. **Integration Tests**:
   - Full feedback submission → reset → close workflow
   - Auto-reply confirmation → submission → close workflow
   - Error scenarios (keep page open)

3. **Manual Testing**:
   - Verify 10-second countdown precision
   - Verify 3-second auto-close on success
   - Verify page stays open on error
   - Verify prompt access from AI settings

---

**Implementation Notes**:

- All changes localized to frontend only
- No server-side modifications needed
- Backward compatible with existing MCP server
