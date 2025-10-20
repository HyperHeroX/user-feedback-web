# Specification: Feedback Submission Reset

## Capability: feedback-submission-reset

### Overview

This specification defines the behavior for resetting user input after feedback submission, with selective clearing to preserve prompt-related configurations.

## ADDED Requirements



### Requirement: Selective Input Clearing on Successful Submission

The system SHALL selectively clear user input fields after a successful feedback submission while preserving prompt and AI settings state.

#### Scenario: User successfully submits feedback

Given:

- Feedback has been submitted without errors
- User has text in the textarea
- User has uploaded images
- User has pinned prompts loaded

When:

- Server responds with `feedback_submitted` event (success)

Then:

- The system SHALL clear the textarea (feedback text).
- The system SHALL remove all uploaded images and image previews.
- The system SHALL reset the character count to 0.
- The system SHALL clear the description field, if present.
- The system SHALL preserve prompt configurations (pinned prompts remain in state).
- The system SHALL preserve AI settings.
- The system SHALL keep the page visible for 3 seconds and then close automatically if configured to do so.



### Requirement: Page Persistence on Submission Error

The system SHALL preserve user input and keep the page open when a submission error occurs.

#### Scenario: User submits feedback but server returns an error

Given:

- Feedback submission is attempted
- Server responds with `feedback_error` event

When:

- Error event is received with error message

Then:

- The system SHALL preserve all user input (no clearing) when a submission error occurs.
- The system SHALL display the error message as a toast notification.
- The system SHALL keep the page open and NOT auto-close on error.
- The user SHALL be able to edit and resubmit the feedback.



### Requirement: New `clearSubmissionInputs()` Function

The frontend SHALL provide a `clearSubmissionInputs()` function that resets only the intended input fields after successful submission.

#### Scenario: Frontend needs to reset input on successful submission

Given:

- Feedback submission is successful
- Page needs to be cleared for next session or closing

When:

- `clearSubmissionInputs()` is called after `feedback_submitted` event

Then:

- The `clearSubmissionInputs()` function SHALL clear the textarea, images, image previews, character count, and description field.
- The `clearSubmissionInputs()` function SHALL preserve prompt state, AI settings, and the active Socket.IO connection.
- The `clearSubmissionInputs()` function SHALL complete without throwing errors.

## ADDED Requirements



### Requirement: Update `feedback_submitted` Socket.IO Event Handler

The `feedback_submitted` Socket.IO event handler SHALL orchestrate clearing inputs, showing success messages, and scheduling an optional auto-close.

#### Scenario: Feedback submission completes successfully

Given:

- `feedback_submitted` event received from server

When:

- Event data includes success status

Then:

- The event handler SHALL hide any alert/confirmation modals.
- The event handler SHALL call `clearSubmissionInputs()` to reset the form.
- The event handler SHALL show a success toast message.
- If `shouldCloseAfterSubmit` is true, the event handler SHALL schedule the window to close in 3 seconds.
- Otherwise, the event handler SHALL keep the page open.

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
