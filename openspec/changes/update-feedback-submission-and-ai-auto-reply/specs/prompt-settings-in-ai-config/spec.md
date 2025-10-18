# Specification: Prompt Settings in AI Configuration

## Capability: prompt-settings-in-ai-config

### Overview

This specification defines the addition of a prompt management button within the AI Settings modal, allowing users to edit prompts without leaving the settings interface.

## ADDED Requirements

### Requirement: Add Prompt Settings Button in AI Configuration Modal

**Scenario**: User opens AI Settings modal

Given:

- AI Settings modal is open
- Modal footer is visible

When:

- Modal is displayed

Then:

- A new button labeled "編輯提示詞" (Edit Prompts) is added to modal footer
- Button appears before or next to existing "儲存設定" (Save Settings) button
- Button has icon "📝" or similar
- Button is always enabled (no conditional visibility)

### Requirement: Open Prompt Management from AI Settings

**Scenario**: User clicks the prompt settings button in AI modal

Given:

- AI Settings modal is open
- "編輯提示詞" button is visible

When:

- User clicks the "編輯提示詞" button

Then:

- AI Settings modal remains open (or temporarily hidden, may be re-shown after)
- Prompt management modal (existing `promptModal`) opens
- User can create, edit, or delete prompts as normal
- All existing prompt functionality works unchanged

### Requirement: Return to AI Settings After Prompt Edit

**Scenario**: User closes prompt modal after editing

Given:

- Prompt modal is open (opened from AI Settings)
- User has made changes or clicked cancel

When:

- User clicks close/cancel on prompt modal, OR
- User saves a prompt and modal auto-closes

Then:

- Prompt modal closes
- AI Settings modal becomes visible again (or regains focus)
- Both modals may be overlaid or AI Settings may re-appear
- No data loss or state corruption

### Requirement: No Modal Stacking Issues

**Scenario**: Modals are opened in sequence

Given:

- AI Settings modal is open
- User clicks prompt settings button
- Prompt modal opens

When:

- Either modal is closed via overlay click, Escape key, or button

Then:

- Correct modal closes (not both)
- No orphaned overlay elements
- Page remains responsive
- Modal stacking is handled gracefully

## MODIFIED Requirements

### Requirement: Enhance AI Settings Modal Footer

**Scenario**: AI Settings modal layout update

Given:

- AI Settings modal is rendered in HTML

When:

- Modal footer section is defined

Then:

- Footer includes: "測試連接" (Test Connection), "編輯提示詞" (Edit Prompts), "儲存設定" (Save Settings)
- Buttons are laid out horizontally with consistent spacing
- All buttons are at same height and aligned

## Implementation Notes

- Button click handler should call `openPromptModal()` (existing function)
- No new modal component needed; reuse existing `promptModal`
- Prompt modal should close normally after user action
- Modal overlay behavior should be managed properly to avoid stacking issues
- Consider using CSS `z-index` to manage layering if needed
- Button order in footer: left-to-right preference is: Test → Edit Prompts → Save

## Test Scenarios

1. **Button Presence**: Verify button exists in AI Settings footer
2. **Button Click**: Click button opens prompt modal
3. **Prompt Operations**: Create/edit/delete prompts from this entry point
4. **Modal Return**: Closing prompt modal shows AI Settings again
5. **No Data Loss**: Changes in prompt modal are persisted
6. **Modal Layering**: No visual overlapping or z-index issues
