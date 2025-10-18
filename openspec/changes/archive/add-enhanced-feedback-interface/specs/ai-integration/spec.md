# Specification Delta: AI Integration

## ADDED Requirements

### Requirement: AI Settings Configuration

The system SHALL provide a configuration interface for AI service settings.

#### Scenario: User Opens AI Settings Modal

- **GIVEN** the user is viewing the prompt management panel
- **WHEN** the user clicks the "AI Settings" button
- **THEN** a modal dialog SHALL open displaying the AI configuration form
- **AND** the form SHALL include fields for:
  - API URL (required, URL format validation)
  - Model Name (required, text input)
  - API Key (required, password input with show/hide toggle)
  - System Prompt (optional, multi-line text, max 2,000 characters)
- **AND** existing settings SHALL be pre-filled (except API Key shows masked value)

#### Scenario: User Saves AI Settings

- **GIVEN** the user has modified AI settings in the modal
- **WHEN** the user clicks "Save" button
- **THEN** the settings SHALL be validated (required fields, URL format)
- **AND** if valid, the API Key SHALL be encrypted before storage
- **AND** all settings SHALL be persisted to the database
- **AND** a success message SHALL be displayed: "Settings saved successfully"
- **AND** the modal SHALL close

#### Scenario: User Cancels AI Settings Changes

- **GIVEN** the user has modified AI settings in the modal
- **WHEN** the user clicks "Cancel" button
- **THEN** all changes SHALL be discarded
- **AND** the modal SHALL close without saving
- **AND** existing settings SHALL remain unchanged

---

### Requirement: API Key Secure Storage

The system SHALL securely store AI API keys using encryption.

#### Scenario: System Encrypts API Key on Save

- **GIVEN** the user enters an API key in the settings form
- **WHEN** the user saves the settings
- **THEN** the API key SHALL be encrypted using AES-256-GCM
- **AND** the encryption SHALL use a master key from environment variable
- **AND** each API key SHALL have a unique initialization vector (IV)
- **AND** only the encrypted value SHALL be stored in the database

#### Scenario: System Decrypts API Key for Use

- **GIVEN** an encrypted API key is stored in the database
- **WHEN** the system needs to call the AI service
- **THEN** the API key SHALL be decrypted in memory
- **AND** the decrypted key SHALL be used for the API call
- **AND** the decrypted key SHALL not be logged or exposed to client
- **AND** the decryption SHALL complete within 100ms

#### Scenario: System Displays Masked API Key to User

- **GIVEN** an encrypted API key is stored
- **WHEN** the user opens the AI settings modal
- **THEN** the API key field SHALL show a masked value (e.g., `sk-...****1234`)
- **AND** the masked value SHALL show only the last 4 characters
- **AND** the user SHALL be able to click "Show" to reveal the full key temporarily
- **AND** when "Hide" is clicked, the key SHALL be masked again

---

### Requirement: AI Reply Generation

The system SHALL generate suggested replies using the configured AI service.

#### Scenario: User Requests AI Reply

- **GIVEN** an AI message is displayed in the left panel
- **AND** AI settings are configured with valid credentials
- **WHEN** the user clicks the "AI Reply" button
- **THEN** a loading indicator SHALL be displayed
- **AND** the system SHALL construct a prompt with:
  - System prompt from settings
  - AI message content as context
  - Request for suggested reply
- **AND** the system SHALL call Gemini API with the prompt
- **AND** the generated reply SHALL be inserted into the text input area
- **AND** the entire process SHALL complete within 10 seconds (or timeout)

#### Scenario: AI Reply with Custom System Prompt

- **GIVEN** the user has configured a custom system prompt (e.g., "Respond professionally and concisely")
- **WHEN** the user requests AI reply
- **THEN** the custom system prompt SHALL be included in the API call
- **AND** the AI's response SHALL reflect the system prompt's instructions

#### Scenario: AI Reply Generation Times Out

- **GIVEN** the user has requested AI reply
- **WHEN** the AI service does not respond within 10 seconds
- **THEN** the request SHALL be aborted
- **AND** an error message SHALL be displayed: "AI reply timed out. Please try again."
- **AND** the loading indicator SHALL be removed
- **AND** the user SHALL be able to retry or proceed with manual input

---

### Requirement: AI Service Error Handling

The system SHALL gracefully handle AI service errors and provide actionable feedback.

#### Scenario: Invalid API Key Error

- **GIVEN** the user has configured an invalid API key
- **WHEN** the user requests AI reply
- **THEN** the system SHALL receive a 401/403 error from Gemini API
- **AND** an error message SHALL be displayed: "Invalid API Key. Please check your settings."
- **AND** a button SHALL be provided: "Open AI Settings"
- **AND** clicking the button SHALL open the AI settings modal

#### Scenario: Rate Limit Exceeded Error

- **GIVEN** the user has exceeded their API rate limit
- **WHEN** the user requests AI reply
- **THEN** the system SHALL receive a 429 error from Gemini API
- **AND** an error message SHALL be displayed: "Rate limit exceeded. Please try again in X seconds."
- **AND** the system SHALL extract retry-after time from error response
- **AND** the "AI Reply" button SHALL be disabled for the retry duration

#### Scenario: API Quota Exceeded Error

- **GIVEN** the user has exhausted their API quota
- **WHEN** the user requests AI reply
- **THEN** the system SHALL receive a quota error from Gemini API
- **AND** an error message SHALL be displayed: "API quota exceeded. Please check your account."
- **AND** a link SHALL be provided to the Gemini API console

#### Scenario: Network Connection Error

- **GIVEN** the user has no internet connection
- **WHEN** the user requests AI reply
- **THEN** the system SHALL detect network failure
- **AND** an error message SHALL be displayed: "Network error. Please check your connection."
- **AND** the user SHALL be able to retry when connection is restored

---

### Requirement: AI Reply Retry Mechanism

The system SHALL automatically retry failed AI requests with exponential backoff.

#### Scenario: AI Reply Retries on Transient Error

- **GIVEN** the AI service returns a 500 error (server error)
- **WHEN** the first request fails
- **THEN** the system SHALL automatically retry after 1 second
- **AND** if the second attempt fails, retry after 2 seconds
- **AND** if the third attempt fails, retry after 4 seconds
- **AND** after 3 failed attempts, display error message to user

#### Scenario: AI Reply Succeeds on Retry

- **GIVEN** the first AI request failed with a transient error
- **WHEN** the system retries the request
- **AND** the retry succeeds
- **THEN** the generated reply SHALL be inserted into the input area
- **AND** no error message SHALL be displayed
- **AND** the user SHALL not be aware of the retry (seamless experience)

#### Scenario: User Cancels AI Reply During Retry

- **GIVEN** an AI reply request is in retry mode
- **WHEN** the user clicks "Cancel" button
- **THEN** all pending retries SHALL be aborted
- **AND** the loading indicator SHALL be removed
- **AND** no error message SHALL be displayed (user-initiated cancellation)

---

### Requirement: AI Settings Validation

The system SHALL validate AI settings before saving and using them.

#### Scenario: User Tests API Key Validity

- **GIVEN** the user has entered an API key in the settings modal
- **WHEN** the user clicks "Test API Key" button
- **THEN** the system SHALL make a test API call to Gemini
- **AND** if successful, display success message: "API Key is valid ✓"
- **AND** if failed, display error with reason: "API Key test failed: [reason]"
- **AND** the test SHALL complete within 5 seconds

#### Scenario: User Saves Settings with Invalid URL

- **GIVEN** the user enters an invalid URL in the API URL field (e.g., "not a url")
- **WHEN** the user clicks "Save" button
- **THEN** a validation error SHALL be displayed: "Invalid URL format"
- **AND** the URL field SHALL be highlighted
- **AND** the form SHALL not submit

#### Scenario: User Saves Settings with Empty Required Fields

- **GIVEN** the user leaves required fields (API URL, Model, API Key) empty
- **WHEN** the user clicks "Save" button
- **THEN** validation errors SHALL be displayed for each empty field
- **AND** the first empty field SHALL be focused
- **AND** the form SHALL not submit

---

### Requirement: Auto-Reply with AI Integration

The system SHALL automatically generate AI reply when user is inactive for configured duration.

#### Scenario: Auto-Reply Triggered After Timeout

- **GIVEN** the user has been inactive for 300 seconds (default timeout)
- **AND** AI settings are configured
- **WHEN** the timeout expires
- **THEN** the system SHALL automatically request AI reply
- **AND** the generated reply SHALL be inserted into the input area
- **AND** the feedback SHALL be auto-submitted
- **AND** a notification SHALL inform the user: "Auto-reply submitted due to inactivity"

#### Scenario: Auto-Reply with AI Service Error

- **GIVEN** the auto-reply timeout has expired
- **WHEN** the system attempts to generate AI reply
- **AND** the AI service returns an error
- **THEN** the system SHALL submit empty feedback (as fallback)
- **AND** the error SHALL be logged
- **AND** the user SHALL be notified: "Auto-submitted empty feedback (AI unavailable)"

#### Scenario: User Activity Resets Auto-Reply Timer

- **GIVEN** the auto-reply timer is counting down (e.g., 200 seconds elapsed)
- **WHEN** the user types in the input area or clicks anywhere
- **THEN** the timer SHALL reset to 300 seconds
- **AND** the countdown warning (if displayed) SHALL be dismissed
- **AND** the reset SHALL be logged

---

### Requirement: AI Reply Caching

The system SHALL optionally cache AI-generated replies to reduce API costs and improve performance.

#### Scenario: Identical AI Message Gets Cached Reply

- **GIVEN** the user has requested AI reply for a specific AI message
- **AND** the reply was cached (cache TTL: 5 minutes)
- **WHEN** the user requests AI reply for the same AI message again (within 5 minutes)
- **THEN** the system SHALL return the cached reply
- **AND** no API call SHALL be made
- **AND** the cached reply SHALL be inserted within 200ms

#### Scenario: Cache Expires and New Reply Generated

- **GIVEN** a cached AI reply exists but has exceeded TTL (5 minutes)
- **WHEN** the user requests AI reply for the same AI message
- **THEN** the system SHALL invalidate the cache
- **AND** a new API call SHALL be made
- **AND** the new reply SHALL replace the old cache entry

---

## MODIFIED Requirements

None (this is a new capability).

---

## REMOVED Requirements

None (this is a new capability).
