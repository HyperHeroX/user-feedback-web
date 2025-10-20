# prompt-settings-in-ai-config Specification

## Purpose
TBD - created by archiving change update-feedback-submission-and-ai-auto-reply. Update Purpose after archive.
## Requirements
### Requirement: Enhance AI Settings Modal Footer

The AI Settings modal footer SHALL include Test, Edit Prompts, and Save controls arranged consistently.

#### Scenario: AI Settings modal layout update

Given:

- AI Settings modal is rendered in HTML

When:

- Modal footer section is defined

Then:

- The footer SHALL include: "測試連接" (Test Connection), "編輯提示詞" (Edit Prompts), "儲存設定" (Save Settings).
- The buttons SHALL be laid out horizontally with consistent spacing.
- All buttons SHALL be visually aligned and of the same height.

### Requirement: Add Prompt Settings Button in AI Configuration Modal

The AI Settings modal SHALL include a visible "編輯提示詞" (Edit Prompts) button in its footer to open prompt management.

#### Scenario: User opens AI Settings modal

Given:

- AI Settings modal is open
- Modal footer is visible

When:

- Modal is displayed

Then:

- The system SHALL add a new button labeled "編輯提示詞" (Edit Prompts) to the modal footer.
- The button SHALL appear before or next to the existing "儲存設定" (Save Settings) button.
- The button SHALL include an icon such as "📝".
- The button SHALL be always enabled and visible (no conditional visibility).

### Requirement: Open Prompt Management from AI Settings

Clicking the edit prompts button SHALL open the prompt management modal without losing AI settings state.

#### Scenario: User clicks the prompt settings button in AI modal

Given:

- AI Settings modal is open
- "編輯提示詞" button is visible

When:

- User clicks the "編輯提示詞" button

Then:

- The AI Settings modal SHALL remain open (or be temporarily hidden and re-shown after).
- The prompt management modal (`promptModal`) SHALL open.
- The user SHALL be able to create, edit, or delete prompts as normal.
- Existing prompt functionality SHALL remain unchanged.

### Requirement: Return to AI Settings After Prompt Edit

After prompt editing, the system SHALL return focus to the AI Settings modal and preserve any unsaved AI setting changes.

#### Scenario: User closes prompt modal after editing

Given:

- Prompt modal is open (opened from AI Settings)
- User has made changes or clicked cancel

When:

- User clicks close/cancel on prompt modal, OR
- User saves a prompt and modal auto-closes

Then:

- The prompt modal SHALL close.
- The AI Settings modal SHALL become visible again or regain focus.
- There SHALL be no data loss or state corruption.

### Requirement: No Modal Stacking Issues

The UI SHALL correctly handle modal stacking so that opening and closing prompt and AI settings modals does not cause overlay or focus issues.

#### Scenario: Modals are opened in sequence

Given:

- AI Settings modal is open
- User clicks prompt settings button
- Prompt modal opens

When:

- Either modal is closed via overlay click, Escape key, or button

Then:

- The system SHALL close the correct modal (not both) when requested.
- The system SHALL not leave orphaned overlay elements.
- The page SHALL remain responsive.
- Modal stacking SHALL be handled gracefully.

