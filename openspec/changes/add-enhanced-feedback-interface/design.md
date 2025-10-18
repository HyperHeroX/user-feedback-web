# Design Document: Enhanced Feedback Interface with AI Integration

## Architecture Overview

This change introduces a sophisticated feedback collection system with AI-powered assistance, prompt management, and persistent data storage. The architecture follows a three-tier model:

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Browser)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │ AI Panel │  │ User     │  │ Prompt Management Panel  │  │
│  │ (30%)    │  │ Input    │  │ (30%)                    │  │
│  │ Markdown │  │ (40%)    │  │ - CRUD                   │  │
│  │ Renderer │  │ - Text   │  │ - Pin/Unpin              │  │
│  │          │  │ - Images │  │ - AI Settings Modal      │  │
│  └──────────┘  └──────────┘  └──────────────────────────┘  │
│                         ↕ WebSocket + HTTP                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Node.js/Express)                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ Web Server  │  │ AI Service   │  │ Database Layer   │   │
│  │ - REST API  │  │ - Gemini API │  │ - SQLite         │   │
│  │ - WebSocket │  │ - Retry      │  │ - Encryption     │   │
│  │ - Session   │  │ - Cache      │  │ - Migration      │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Persistence                        │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ SQLite DB    │  │ Encrypted    │  │ Environment     │   │
│  │ - prompts    │  │ API Keys     │  │ Variables       │   │
│  │ - ai_settings│  │ (AES-256)    │  │ - Encryption    │   │
│  │ - preferences│  │              │  │   Key           │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Database Choice: SQLite

**Decision**: Use SQLite with `better-sqlite3` for data persistence.

**Rationale**:
- ✅ Zero configuration, embedded database
- ✅ Single file, easy backup and migration
- ✅ Synchronous API, simpler error handling
- ✅ Sufficient performance for expected workload
- ✅ Cross-platform compatibility

**Alternatives Considered**:
- JSON file storage: Too simplistic, no ACID guarantees, concurrency issues
- PostgreSQL/MySQL: Over-engineered for this use case, requires external service
- MongoDB: Overkill for structured data, additional dependency

**Trade-offs**:
- ⚠️ Limited concurrent write performance (acceptable for single-user tool)
- ⚠️ No network access (acceptable, data is local)

### 2. API Key Encryption: AES-256-GCM

**Decision**: Use Node.js crypto module with AES-256-GCM for API key encryption.

**Rationale**:
- ✅ Industry-standard encryption algorithm
- ✅ Authenticated encryption (prevents tampering)
- ✅ Built-in to Node.js (no external dependencies)
- ✅ Suitable for small data (API keys)

**Implementation Details**:
```typescript
// Encryption key derivation
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.MCP_ENCRYPTION_PASSWORD || 'default-key',
  'salt', // Should be unique per installation
  32
);

// Encryption
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}
```

**Security Considerations**:
- Master encryption key stored in environment variable or secure config
- Each API key encrypted with unique IV (initialization vector)
- Authentication tag prevents tampering
- Key derivation uses scrypt (memory-hard, resistant to brute force)

**Trade-offs**:
- ⚠️ Not protected from local administrator access (acceptable, local tool)
- ⚠️ Key management responsibility on user (provide clear documentation)

### 3. AI Integration: Gemini API via Official SDK

**Decision**: Use `@google/generative-ai` SDK for Gemini integration.

**Rationale**:
- ✅ Official SDK, maintained by Google
- ✅ TypeScript support
- ✅ Automatic retry and error handling
- ✅ Streaming support (future enhancement)

**API Call Pattern**:
```typescript
async function generateAIReply(
  aiMessage: string,
  userContext: string,
  settings: AISettings
): Promise<string> {
  const genAI = new GoogleGenerativeAI(settings.apiKey);
  const model = genAI.getGenerativeModel({ model: settings.model });
  
  const prompt = `${settings.systemPrompt}\n\nAI Message:\n${aiMessage}\n\nUser Context:\n${userContext}\n\nGenerate a helpful reply:`;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

**Retry Strategy**:
- 3 retries with exponential backoff (1s, 2s, 4s)
- Handle rate limit errors (429) with longer backoff
- Handle quota exceeded errors (429) with user-friendly message
- Cache successful responses (optional, 5-minute TTL)

**Trade-offs**:
- ⚠️ Dependency on external service availability
- ⚠️ API costs (user responsibility, provide cost estimation tool)
- ⚠️ Network latency (add loading indicators)

### 4. Frontend Markdown Rendering: Marked.js

**Decision**: Use `marked` library for Markdown rendering.

**Rationale**:
- ✅ Lightweight (~20KB minified)
- ✅ Fast parsing and rendering
- ✅ GFM (GitHub Flavored Markdown) support
- ✅ Extensible with custom renderers

**Configuration**:
```javascript
marked.setOptions({
  gfm: true,
  breaks: true,
  sanitize: true, // Prevent XSS
  highlight: function(code, lang) {
    // Optional: Code highlighting with Prism.js
    return Prism.highlight(code, Prism.languages[lang], lang);
  }
});
```

**Alternatives Considered**:
- markdown-it: More features, but heavier (~60KB)
- showdown: Older, less maintained
- Custom implementation: Too much effort, reinventing the wheel

**Trade-offs**:
- ⚠️ Client-side rendering cost (acceptable, modern browsers are fast)
- ⚠️ XSS risk if not sanitized (mitigated with `sanitize: true` option)

### 5. UI Layout: CSS Grid for Three-Column Design

**Decision**: Use CSS Grid for responsive three-column layout.

**Rationale**:
- ✅ Native browser support (no framework needed)
- ✅ Simple responsive breakpoints
- ✅ Flexible column sizing (30%-40%-30%)
- ✅ Better performance than Flexbox for complex layouts

**Layout Structure**:
```css
.feedback-container {
  display: grid;
  grid-template-columns: 30% 40% 30%;
  gap: 16px;
  height: 100vh;
}

@media (max-width: 768px) {
  .feedback-container {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }
}
```

**Responsive Strategy**:
- Desktop (>768px): Three-column layout
- Tablet/Mobile (<768px): Single-column stack:
  1. Prompt panel (collapsible)
  2. AI message panel
  3. User input panel

**Trade-offs**:
- ⚠️ Complex CSS for edge cases (handled with thorough testing)
- ⚠️ Reduced usability on very small screens (acceptable, provide desktop warning)

### 6. Auto-Reply Mechanism: Server-Side Timer with WebSocket Notifications

**Decision**: Implement timer on server-side, notify client via WebSocket.

**Rationale**:
- ✅ Reliable timing (not affected by browser throttling)
- ✅ Prevents client-side timer manipulation
- ✅ Centralized timeout management
- ✅ Survives page reloads (timer persists in session)

**Timer Flow**:
```
1. User opens feedback page → Server starts 300s timer
2. User activity (typing, clicks) → Server resets timer via WebSocket
3. 240s elapsed → Server sends "warning" event (60s remaining)
4. 300s elapsed → Server triggers AI auto-reply
5. AI reply generated → Server sends "auto_reply_triggered" event
6. Client displays AI-generated response → User can review and submit
```

**WebSocket Events**:
```typescript
// Server → Client
socket.emit('auto_reply_warning', { remainingSeconds: 60 });
socket.emit('auto_reply_triggered', { reply: '...' });

// Client → Server
socket.emit('user_activity', { sessionId: '...' });
socket.emit('cancel_auto_reply', { sessionId: '...' });
```

**Trade-offs**:
- ⚠️ Requires active WebSocket connection (reconnect logic needed)
- ⚠️ Timer state not persisted across server restarts (acceptable for dev tool)

### 7. Prompt Management: Order Preservation and Pin Priority

**Decision**: Use `order` field (integer) and `isPinned` flag for sorting.

**Database Schema**:
```sql
CREATE TABLE prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned INTEGER DEFAULT 0,  -- Boolean: 0 or 1
  order_index INTEGER NOT NULL,  -- Custom order
  category TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prompts_pinned_order ON prompts(is_pinned DESC, order_index ASC);
```

**Sorting Logic**:
1. Pinned prompts first (is_pinned = 1)
2. Within pinned group, sort by order_index ASC
3. Unpinned prompts next (is_pinned = 0)
4. Within unpinned group, sort by order_index ASC

**Auto-Load on Startup**:
```typescript
// Load pinned prompts in order and insert into input area
const pinnedPrompts = db.prepare(
  'SELECT * FROM prompts WHERE is_pinned = 1 ORDER BY order_index ASC'
).all();

const autoLoadContent = pinnedPrompts
  .map(p => p.content)
  .join('\n\n');

// Send to client
socket.emit('auto_load_prompts', { content: autoLoadContent });
```

**Trade-offs**:
- ⚠️ Manual order management (no drag-drop in MVP, can add later)
- ⚠️ No categories in MVP (can add later with filtering)

## Data Flow Diagrams

### User Submits Feedback with AI Assistance

```
┌──────┐                  ┌────────┐                 ┌──────────┐
│Client│                  │ Server │                 │Gemini API│
└──┬───┘                  └───┬────┘                 └────┬─────┘
   │  1. Load page           │                            │
   ├─────────────────────────>│                            │
   │  2. WebSocket connect   │                            │
   ├─────────────────────────>│                            │
   │  3. Start timer (300s)  │                            │
   │<─────────────────────────┤                            │
   │  4. Load prompts        │                            │
   │<─────────────────────────┤                            │
   │  5. Click "AI Reply"    │                            │
   ├─────────────────────────>│                            │
   │  6. Call Gemini API     │                            │
   │                          ├────────────────────────────>│
   │                          │  7. Generate reply         │
   │                          │<────────────────────────────┤
   │  8. Display AI reply    │                            │
   │<─────────────────────────┤                            │
   │  9. User reviews/edits  │                            │
   │  10. Submit feedback    │                            │
   ├─────────────────────────>│                            │
   │  11. Save to session    │                            │
   │  12. Confirmation       │                            │
   │<─────────────────────────┤                            │
```

### Auto-Reply Timeout Flow

```
┌──────┐                  ┌────────┐                 ┌──────────┐
│Client│                  │ Server │                 │Gemini API│
└──┬───┘                  └───┬────┘                 └────┬─────┘
   │  1. Idle (240s)         │                            │
   │                          │  (Timer running)           │
   │  2. Warning (60s left)  │                            │
   │<─────────────────────────┤                            │
   │  3. Display countdown   │                            │
   │  4. Still idle (300s)   │                            │
   │                          │  (Timeout triggered)       │
   │  5. Call AI auto-reply  │                            │
   │                          ├────────────────────────────>│
   │                          │  6. Generate auto-reply    │
   │                          │<────────────────────────────┤
   │  7. Display AI reply    │                            │
   │<─────────────────────────┤                            │
   │  8. Auto-submit         │                            │
   ├─────────────────────────>│                            │
   │  9. Confirmation        │                            │
   │<─────────────────────────┤                            │
```

## Security Considerations

### 1. API Key Protection
- Encrypted at rest (AES-256-GCM)
- Never sent to client in full (only masked: `sk-...****1234`)
- Environment variable for encryption master key
- Recommendation: Use separate API key for this tool (not main account key)

### 2. SQL Injection Prevention
- Use parameterized queries exclusively
- Example: `db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId)`
- Never concatenate user input into SQL strings

### 3. XSS Prevention
- Sanitize Markdown output with `marked.sanitize: true`
- Escape user input in HTML context
- Content Security Policy (CSP) headers via Helmet.js

### 4. CSRF Protection
- WebSocket authentication via session tokens
- Validate origin headers
- Rate limiting on API endpoints (10 req/min per IP)

### 5. Secrets Management
- `.env` file for local development (excluded from git)
- Environment variables for production
- Provide `.env.example` template
- Document key rotation procedure

## Performance Considerations

### 1. Markdown Rendering
- Debounce rendering on user input (300ms delay)
- Render in Web Worker for long documents (optional)
- Cache rendered output (5-minute TTL)

### 2. Database Queries
- Index on frequently queried columns (`is_pinned`, `order_index`)
- Limit query results (max 100 prompts)
- Use `EXPLAIN QUERY PLAN` to optimize slow queries

### 3. AI API Calls
- Implement request queue (max 2 concurrent)
- Cache AI responses (5-minute TTL, LRU eviction)
- Abort pending requests on user action
- Estimate cost before calling API (token count * price)

### 4. Frontend Bundle Size
- Lazy load Markdown renderer (dynamic import)
- Code split by route/feature
- Tree-shake unused dependencies
- Target: <200KB total bundle size (gzipped)

## Testing Strategy

### Unit Tests
- Database CRUD operations (prompts, ai_settings)
- Encryption/decryption functions
- AI service API calls (with mocks)
- Timer management logic

### Integration Tests
- End-to-end prompt management flow
- AI reply generation with test API key
- Auto-reply timeout trigger
- WebSocket reconnection handling

### UI Tests
- Responsive layout on multiple screen sizes
- Keyboard shortcuts (Ctrl+Enter, Esc)
- Drag-and-drop functionality (if implemented)
- Accessibility (screen reader, keyboard navigation)

### Load Tests
- Simulate 10 concurrent feedback sessions
- Test AI API rate limiting behavior
- Database performance with 1000+ prompts

## Migration Path

### From Current Version to Enhanced Version

1. **Backward Compatibility**:
   - Old URL format still works: `/`
   - New URL with feature flag: `/?enhanced=true`
   - After 3 months, make enhanced version default

2. **Data Migration**:
   - No existing data to migrate (fresh database)
   - Provide import tool for users with custom configs

3. **Deprecation Timeline**:
   - v2.2.0: Enhanced version available (opt-in)
   - v2.3.0: Enhanced version default (legacy opt-in via `?legacy=true`)
   - v3.0.0: Remove legacy version (breaking change)

## Future Enhancements

### Short-term (Next 3-6 months)
- Prompt templates with variables (e.g., `{{task_name}}`)
- Prompt categories and filtering
- Export/import prompt collections
- AI conversation history (within session)
- Code syntax highlighting in Markdown

### Long-term (6-12 months)
- Multi-user support (optional authentication)
- Cloud sync for prompts (optional paid feature)
- Browser extension for quick access
- Mobile app (React Native)
- Webhook integration (send feedback to external systems)

## Open Questions

1. **Q**: Should we support multiple AI providers (OpenAI, Claude, etc.)?
   **A**: Start with Gemini, add provider abstraction layer for future extensibility

2. **Q**: How to handle very long AI messages (>10,000 characters)?
   **A**: Implement pagination or "Read More" collapse for long messages

3. **Q**: Should prompts support Markdown formatting?
   **A**: Yes, but render as plain text in prompt list, only render when inserted to input

4. **Q**: Database backup strategy?
   **A**: Automatic daily backup to `data/backups/`, keep last 7 days

5. **Q**: Error telemetry and logging?
   **A**: Log to file (`logs/feedback.log`), optional anonymous telemetry (opt-in)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-18
**Authors**: AI Assistant, Product Team
**Status**: Draft - Awaiting Review
