# Specification: Auto-Reply Confirmation Timeout

## Capability: auto-reply-confirmation

### Overview

This specification defines the behavior for displaying a confirmation prompt before auto-submitting AI-generated replies, including a 10-second countdown timer.

## ADDED Requirements

### Requirement: Display 10-Second Confirmation Modal on Auto-Reply

**Scenario**: AI generates a reply and server sends `auto_reply_triggered` event

Given:

- User has enabled auto-reply
- AI has generated a reply
- Server sends `auto_reply_triggered` event with reply content

When:

- Event is received with the AI-generated reply

Then:

- Confirmation modal is displayed
- Modal shows: "AI 已完成回覆" (or similar)
- Modal shows the generated reply content (read-only preview)
- Countdown timer displays "自動送出於 X 秒後" (auto-submit in X seconds)
- Timer counts down from 10 to 0 seconds
- "確認送出" (Confirm Submit) button is displayed
- "取消" (Cancel) button is displayed
- User can interact with page while modal is displayed

### Requirement: Auto-Submit on Timeout or User Confirmation

**Scenario**: 10-second countdown completes or user clicks Confirm

Given:

- Confirmation modal is displayed with countdown running
- Reply content is populated in the modal

When:

- Countdown reaches 0 seconds, OR
- User clicks "確認送出" button

Then:

- Modal is closed
- Reply text is filled into textarea
- `clearSubmissionInputs()` is NOT called yet
- Auto-submit feedback with the reply (emit `submit_feedback`)
- Apply feedback-submission-reset requirements (clear after success, keep on error)
- Apply 3-second auto-close on success requirement

### Requirement: Cancel Auto-Reply Confirmation

**Scenario**: User cancels the auto-reply confirmation

Given:

- Confirmation modal is displayed

When:

- User clicks "取消" button, OR
- User presses Escape key

Then:

- Modal is closed
- Reply text is NOT filled into textarea
- Page remains open
- Page stays in ready state for manual reply

### Requirement: Store Pending Auto-Reply Data

**Scenario**: Auto-reply event received and needs to be held until user action

Given:

- `auto_reply_triggered` event is received

When:

- Event contains reply data and remaining time

Then:

- Store reply data in `autoReplyData` global variable
- Store countdown start time
- Enable modal and timer functions to access this data

## MODIFIED Requirements

### Requirement: Update `auto_reply_triggered` Socket.IO Event Handler

**Scenario**: Server sends auto-reply data

Given:

- `auto_reply_triggered` event received with `{ reply, remainingSeconds, ... }`

When:

- Event handler processes the reply

Then:

- Store reply in `autoReplyData`
- Show confirmation modal instead of directly filling textarea
- Initialize 10-second countdown timer
- Make buttons functional (Confirm/Cancel)

### Requirement: Handle Auto-Reply Modal Lifecycle

**Scenario**: Modal countdown and user interactions

Given:

- Confirmation modal is open with countdown

When:

- Countdown completes (reaches 0), OR
- User clicks Confirm, OR
- User clicks Cancel, OR
- User presses Escape

Then:

- Handle each case appropriately (see auto-submit vs. cancel requirements)
- Clean up timer to prevent memory leaks
- Update modal state

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
