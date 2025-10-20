# Specification: Auto-Reply Confirmation Timeout

## Capability: auto-reply-confirmation

### Overview

This specification defines the behavior for displaying a confirmation prompt before auto-submitting AI-generated replies, including a 10-second countdown timer.

## ADDED Requirements


### Requirement: Display 10-Second Confirmation Modal on Auto-Reply

The system SHALL present a 10-second confirmation modal to the user when an auto-reply is generated.

#### Scenario: AI generates a reply and server sends `auto_reply_triggered` event

Given:

- User has enabled auto-reply
- AI has generated a reply
- Server sends `auto_reply_triggered` event with reply content

When:

- Event is received with the AI-generated reply

Then:

- The system SHALL display a confirmation modal when an auto-reply event is received.
- The modal SHALL show the generated reply content in a read-only preview.
- The modal SHALL display a countdown timer indicating auto-submit in X seconds.
- The timer SHALL count down from 10 to 0 seconds.
- The modal SHALL display a "確認送出" (Confirm Submit) button.
- The modal SHALL display a "取消" (Cancel) button.
- The user SHALL be able to interact with the page while the modal is displayed.


### Requirement: Auto-Submit on Timeout or User Confirmation

The system SHALL auto-submit the reply when the countdown reaches zero or the user confirms explicitly.

#### Scenario: 10-second countdown completes or user clicks Confirm

Given:

- Confirmation modal is displayed with countdown running
- Reply content is populated in the modal

When:

- Countdown reaches 0 seconds, OR
- User clicks "確認送出" button

Then:

- The system SHALL close the modal.
- The system SHALL fill the reply text into the textarea.
- The system SHALL NOT call `clearSubmissionInputs()` before submission completes.
- The system SHALL emit `submit_feedback` to auto-submit the reply.
- The system SHALL apply `feedback-submission-reset` behavior on successful submission.
- The system SHALL apply a 3-second auto-close on success.


### Requirement: Cancel Auto-Reply Confirmation

The system SHALL cancel auto-reply submission and preserve page state when the user cancels confirmation.

#### Scenario: User cancels the auto-reply confirmation

Given:

- Confirmation modal is displayed

When:

- User clicks "取消" button, OR
- User presses Escape key

Then:

- The system SHALL close the modal.
- The system SHALL NOT fill the reply text into the textarea.
- The system SHALL keep the page open.
- The system SHALL leave the page in a ready state for manual reply.


### Requirement: Store Pending Auto-Reply Data

The system SHALL store pending auto-reply data (content and countdown) until actioned by the user.

#### Scenario: Auto-reply event received and needs to be held until user action

Given:

- `auto_reply_triggered` event is received

When:

- Event contains reply data and remaining time

Then:

- The system SHALL store reply data in a global `autoReplyData` variable.
- The system SHALL store the countdown start time.
- The system SHALL make the modal and timer functions access this stored data.

## ADDED Requirements

### Requirement: Update `auto_reply_triggered` Socket.IO Event Handler

The `auto_reply_triggered` Socket.IO event handler SHALL store pending reply data and trigger the confirmation modal instead of immediately applying the reply to the UI.

#### Scenario: Server sends auto-reply data

Given:

- `auto_reply_triggered` event received with `{ reply, remainingSeconds, ... }`

When:

- Event handler processes the reply

Then:

- The event handler SHALL store the reply in `autoReplyData`.
- The event handler SHALL show the confirmation modal instead of directly filling the textarea.
- The event handler SHALL initialize a 10-second countdown timer.
- The event handler SHALL make Confirm and Cancel buttons functional.

### Requirement: Handle Auto-Reply Modal Lifecycle

The auto-reply confirmation modal lifecycle SHALL reliably manage timers, user interactions, and state transitions to avoid leaks and inconsistent UI state.

#### Scenario: Modal countdown and user interactions

Given:

- Confirmation modal is open with countdown

When:

- Countdown completes (reaches 0), OR
- User clicks Confirm, OR
- User clicks Cancel, OR
- User presses Escape

Then:

- The system SHALL handle each case appropriately (auto-submit vs. cancel requirements).
- The system SHALL clean up timers to prevent memory leaks.
- The system SHALL update modal state consistently.

## Implementation Notes

- Countdown timer should be accurate to nearest second (visual feedback is primary)
- Use `setInterval()` for timer, ensure cleanup on modal close
- Reuse existing modal infrastructure
- No API contract changes
- Message text should be in Traditional Chinese (zh-TW)
- Modal should be non-blocking (user can still interact with page)

## Test Scenarios

1. **Happy Path**: Auto-reply triggered → Modal shows → User confirms → Submit → Reset → Close
2. **Timeout Path**: Auto-reply triggered → Modal shows → Countdown to 0 → Auto-submit
3. **Cancel Path**: Auto-reply triggered → Modal shows → User clicks cancel → Modal closes
4. **Escape Key**: Auto-reply triggered → Modal shows → User presses Escape → Modal closes
5. **Timer Accuracy**: Verify countdown is exactly 10 seconds
