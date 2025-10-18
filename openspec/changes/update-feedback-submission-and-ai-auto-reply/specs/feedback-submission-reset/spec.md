# Specification: Feedback Submission Reset

## Capability: feedback-submission-reset

### Overview

This specification defines the behavior for resetting user input after feedback submission, with selective clearing to preserve prompt-related configurations.

## ADDED Requirements

### Requirement: Selective Input Clearing on Successful Submission

**Scenario**: User successfully submits feedback

Given:

- Feedback has been submitted without errors
- User has text in the textarea
- User has uploaded images
- User has pinned prompts loaded

When:

- Server responds with `feedback_submitted` event (success)

Then:

- Textarea (feedback text) is cleared
- All uploaded images are removed
- Character count resets to 0
- Description field is cleared (if applicable)
- **Prompt configurations remain loaded** (pinned prompts stay in state)
- **AI settings remain intact**
- Page stays visible for 3 seconds, then closes automatically

### Requirement: Page Persistence on Submission Error

**Scenario**: User submits feedback but server returns an error

Given:

- Feedback submission is attempted
- Server responds with `feedback_error` event

When:

- Error event is received with error message

Then:

- All user input is **preserved** (not cleared)
- Error message is displayed as toast notification
- Page remains open (no auto-close)
- User can edit and resubmit

### Requirement: New `clearSubmissionInputs()` Function

**Scenario**: Frontend needs to reset input on successful submission

Given:

- Feedback submission is successful
- Page needs to be cleared for next session or closing

When:

- `clearSubmissionInputs()` is called after `feedback_submitted` event

Then:

- Function clears: textarea, images, image previews, char count, description
- Function preserves: prompts state, AI settings, Socket.IO connection
- Completes synchronously without errors

## MODIFIED Requirements

### Requirement: Update `feedback_submitted` Socket.IO Event Handler

**Scenario**: Feedback submission completes successfully

Given:

- `feedback_submitted` event received from server

When:

- Event data includes success status

Then:

- Hide any alert/confirmation modals
- Call `clearSubmissionInputs()` to reset form
- Show success toast message
- If `shouldCloseAfterSubmit: true`, schedule window close for 3 seconds later
- Otherwise, keep page open

## Implementation Notes

- `clearSubmissionInputs()` replaces existing `clearInputs()` logic in submission handler
- Existing `clearImages()` and image preview clearing logic can be reused
- No API contract changes needed
- Socket.IO events remain unchanged

## Test Scenarios

1. **Happy Path**: Submit → Reset → Close
2. **Error Path**: Submit → Error → Stay Open → Can resubmit
3. **State Preservation**: Prompts available after reset
4. **Timing**: Close happens exactly 3 seconds after success
