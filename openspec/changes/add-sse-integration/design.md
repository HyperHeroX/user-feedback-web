# Design Document: SSE Integration for Remote MCP Connectivity

**Change ID:** `add-sse-integration`

## Technical Architecture

### SSE Transport Layer

```
┌─────────────────────────────────────────────────────────────┐
│                      Cursor / MCP Client                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
    1. POST /mcp/init  (get sessionId)
    2. GET /sse?session=xyz  (open stream)
    3. POST /mcp/messages  (send/receive)
          │                 │
    ┌─────┴────────────────┘
    │
    ▼
┌────────────────────────────────────────────────┐
│         Express Web Server                     │
├────────────────────────────────────────────────┤
│                                                 │
│  Routes:                                       │
│  - POST /mcp/init → create session             │
│  - GET /sse?session=xyz → stream events       │
│  - POST /mcp/messages → route to transport    │
│  - DELETE /mcp/close → cleanup                │
│                                                 │
│  Session Manager:                              │
│  - Store active SSE connections               │
│  - Track message queues                       │
│  - Timeout management                         │
│                                                 │
└─────────┬──────────────────────────────────────┘
          │
          │ forwards MCP messages
          ▼
┌────────────────────────────────────────────────┐
│         MCP Server                             │
├────────────────────────────────────────────────┤
│                                                 │
│  Transport Selection:                          │
│  - Stdio (for local, default)                 │
│  - HTTP/SSE (for remote)                      │
│  - Auto-detect based on env                   │
│                                                 │
│  Tool Registry:                                │
│  - collect_feedback tool                      │
│  - Others remain unchanged                    │
│                                                 │
└────────────────────────────────────────────────┘
```

### Message Flow Sequence

#### Scenario 1: Client Connects and Sends Request

```
Time    Client                  Server                MCP Tools
 0      POST /mcp/init
        ────────────────────────>
                                Create session: abc-123
                                <────────────────────
        200 OK { sessionId: "abc-123" }

 1      GET /sse?session=abc-123
        ────────────────────────>
                                Open SSE stream
                                event: ready
                                ────────────────────>
        200 (text/event-stream)

 2      POST /mcp/messages
        { sessionId: "abc-123", 
          message: { jsonrpc: "2.0", 
                     id: 1, 
                     method: "collect_feedback",
                     params: { ... } } }
        ────────────────────────>
                                Parse message
                                Forward to MCP
                                ────────────────────────>
                                                 Process tool call
                                                 return result
                                <────────────────────────
                                Send response via SSE
                                event: message
                                data: { ... response ... }
                                ────────────────────>
        200 OK (or 202 if queued)

 3      Client receives event
        <────────────────────────
        Parse response
        Return to MCP client
```

#### Scenario 2: Reconnection with Queued Messages

```
Time    Client          Server              Notes
 0      GET /sse (disconnects)
        Client network failure

        [Messages arrive while disconnected]

 5      GET /sse?session=abc-123  (reconnect)
        ────────────>
                      Replay queued messages
                      event: message
                      data: { id: 1, ... }
                      event: message
                      data: { id: 2, ... }
                      ────────────>
        Resume stream
```

### SSE Session Lifecycle

```
┌─────────────────────────────────────────┐
│           CREATED                       │
│  POST /mcp/init                         │
│  sessionId: uuid                        │
│  createdAt: timestamp                   │
│  lastActivity: timestamp                │
│  pendingMessages: []                    │
│  timeout: 30s (idle)                    │
└────────────────────┬────────────────────┘
                     │
        ┌────────────┴───────────┐
        │                        │
        ▼ (GET /sse)             ▼ (timeout)
    ┌─────────────┐          ┌─────────────┐
    │  ACTIVE     │◄─────────►│  IDLE       │
    │             │ (activity)│             │
    │ SSE stream  │           │ No stream   │
    │ open        │           │ Messages    │
    │             │           │ queued      │
    └────────┬────┘           └────────┬────┘
             │ (stream close)         │ (cleanup)
             │                        │
             └────────────┬───────────┘
                          │
                  ┌───────▼────────┐
                  │    CLOSED      │
                  │  Resources     │
                  │  released      │
                  │  Expired       │
                  └────────────────┘
```

### Error Handling Strategies

#### Connection Reset During Request

```
Client sends: POST /mcp/messages { ... long running request ... }

Scenario A: Response received before client closes
  Server: Returns 200 with response

Scenario B: Client connection drops during response
  Server: Logs error, keeps session active
  Client: Can reconnect with GET /sse?session=xyz
  Server: Resends cached response (or replay from queue)

Scenario C: No response received (timeout > 30s)
  Client: Retries with exponential backoff
  Server: If query matches previous → return cached result
           Else → return 504 Timeout
```

#### Session Expiration

```
Session idle for 30s:
  1. Server sets cleanup timer
  2. No activity check runs
  3. If no GET /sse → close
  4. If GET /sse received → reset timer
  5. Cleanup:
     - Close SSE connections
     - Clear message queue
     - Remove from sessions map
```

### Configuration Parameters

```typescript
interface SSEConfig {
  // Session management
  SESSION_TIMEOUT: 30 * 1000,        // 30s idle timeout
  SESSION_MAX_MESSAGES: 100,          // Max queued messages per session
  
  // Transport
  SSE_HEARTBEAT_INTERVAL: 10 * 1000,  // Send ping every 10s
  SSE_MESSAGE_TIMEOUT: 30 * 1000,     // Wait 30s for response
  
  // CORS
  SSE_CORS_ORIGINS: ['*'],            // Allow all by default
  
  // Logging
  SSE_DEBUG: false,                   // Verbose SSE logging
}
```

### Type Definitions

```typescript
// ─── MCP Message Types ───
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JSONRPCMessage extends JSONRPCRequest | JSONRPCResponse {}

// ─── SSE Session Types ───
interface SSESession {
  id: string;                      // UUID v4
  createdAt: number;               // Timestamp
  lastActivity: number;            // Last request/activity
  pendingMessages: JSONRPCMessage[];
  stream?: Response;               // Active SSE response
  timeoutHandle?: NodeJS.Timeout;
}

interface SSEInitRequest {
  // No body required
}

interface SSEInitResponse {
  sessionId: string;
  expiresIn: number;              // Seconds until timeout
}

interface SSEMessageRequest {
  sessionId: string;
  message: JSONRPCMessage;
}

interface SSEMessageResponse {
  response: JSONRPCMessage;        // (on success, 200)
  queued: boolean;                 // (on 202 Accepted)
}

// ─── Server Transport Types ───
interface MCP Transport {
  send(message: JSONRPCMessage): Promise<void>;
  onmessage?: (message: JSONRPCMessage) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
}

class HTTPServerTransport implements MCP Transport {
  private baseUrl: string;
  private sessionId: string;
  private sseStream?: EventSource;
  
  constructor(baseUrl: string);
  async send(message: JSONRPCMessage): Promise<void>;
  private reconnect(): Promise<void>;
}

// ─── Environment Variables ───
MCP_TRANSPORT='stdio'|'http'|'auto'      // default: auto
MCP_SSE_BASE_URL=http://localhost:5050   // For clients
MCP_TRANSPORT_MODE='server'|'client'     // (internal)
```

### Testing Strategy

```typescript
// Unit tests for SSE endpoints
describe('SSE Endpoints', () => {
  test('POST /mcp/init returns valid session', async () => {
    const res = await post('/mcp/init');
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toMatch(/^[a-f0-9-]+$/);
    expect(res.body.expiresIn).toBe(30);
  });
  
  test('GET /sse?session=xyz streams events', async () => {
    const { sessionId } = await initSession();
    const stream = get(`/sse?session=${sessionId}`);
    expect(stream.headers['content-type']).toBe('text/event-stream');
    // Receive first event
    const event = await readEvent(stream);
    expect(event.type).toBe('ready');
  });
  
  test('POST /mcp/messages routes to MCP', async () => {
    const { sessionId } = await initSession();
    const res = await post('/mcp/messages', {
      sessionId,
      message: {
        jsonrpc: '2.0',
        id: 1,
        method: 'collect_feedback',
        params: { work_summary: 'test' }
      }
    });
    expect([200, 202]).toContain(res.status);
  });
});
```

### Compatibility Matrix

| Mode | Local | Docker | Remote | Cursor |
|------|-------|--------|--------|--------|
| **Stdio** | ✅ | ❌ (needs container exec) | ❌ | ✅ |
| **HTTP/SSE** | ✅ | ✅ | ✅ | ⚠️ (needs config) |
| **Auto** | ✅ (stdio) | ✅ (HTTP) | ✅ (HTTP) | ✅ |

### Backward Compatibility

- **Existing stdio mode**: Unchanged, remains default
- **New HTTP mode**: Opt-in via `MCP_TRANSPORT=http` or config
- **Auto-detection**: Prefers stdio if available (stdin is ready)
- **Breaking changes**: None - all changes are additive
