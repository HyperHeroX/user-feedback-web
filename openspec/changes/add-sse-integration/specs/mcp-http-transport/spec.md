# Spec Delta: MCP HTTP Transport (SSE) Capability

**Change ID:** `add-sse-integration`  
**Capability:** `mcp-http-transport`  
**Previous Version:** None (new capability)

## ADDED Requirements

### Requirement: HTTP/SSE Transport Support

#### Description
The system SHALL support HTTP-based MCP protocol communication via Server-Sent Events (SSE), enabling remote clients to connect to the MCP server without requiring stdin/stdout access.

#### Requirement ID: `MCP-HTTP-001`

**Requirement Statement:**
The application SHALL provide `/mcp/init` endpoint that creates a session and returns a unique session ID.

**Acceptance Criteria:**
- `POST /mcp/init` responds with HTTP 200 OK
- Response body contains `{ sessionId: "<uuid>", expiresIn: 30 }`
- Session ID is valid UUID v4 format
- Session expires after specified duration (default: 30 seconds)

**Scenario: Initialize SSE Session**
```
Given: Client wants to connect via SSE
When: Client sends POST /mcp/init
Then: Response is 200 OK
  And: Response contains valid sessionId
  And: Session is stored server-side
  And: Client can use sessionId for subsequent requests
```

---

#### Requirement ID: `MCP-HTTP-002`

**Requirement Statement:**
The application SHALL provide `/sse` endpoint that streams MCP messages via Server-Sent Events.

**Acceptance Criteria:**
- `GET /sse?session=<sessionId>` opens persistent HTTP connection
- Response header `Content-Type: text/event-stream`
- Response header `Cache-Control: no-cache`
- Server sends heartbeat ping every 10 seconds
- Stream closes when session expires or connection terminates
- Invalid sessionId returns HTTP 404
- Missing sessionId returns HTTP 400

**Scenario: Open SSE Stream**
```
Given: Valid sessionId from /mcp/init
When: Client sends GET /sse?session=<sessionId>
Then: Connection remains open
  And: Client receives text/event-stream content type
  And: First event within 1 second is type "ready"
  And: Subsequent events sent as JSON-RPC messages
```

**Scenario: Heartbeat Mechanism**
```
Given: SSE stream is open
When: No messages are sent for 10 seconds
Then: Server sends: event: ping\ndata: {}\n\n
  And: Stream remains open
```

---

#### Requirement ID: `MCP-HTTP-003`

**Requirement Statement:**
The application SHALL provide `/mcp/messages` endpoint that routes JSON-RPC messages to MCP tools.

**Acceptance Criteria:**
- `POST /mcp/messages` accepts JSON with sessionId and message
- Request body format: `{ sessionId: string, message: JSONRPCMessage }`
- Valid requests return:
  - HTTP 200 with response (if received within 30s)
  - HTTP 202 with queued flag (if queued for SSE delivery)
- Invalid sessionId returns HTTP 404
- Timeout returns HTTP 504
- Message queuing is transparent to client

**Scenario: Send Message via POST**
```
Given: Valid sessionId and active SSE stream
When: Client sends POST /mcp/messages
  With: { sessionId: "...", message: { jsonrpc: "2.0", id: 1, method: "collect_feedback", ... } }
Then: Response is 200 OK or 202 Accepted
  And: Response includes message result or queued status
  And: Message is processed by MCP tools
```

**Scenario: Handle Queued Messages**
```
Given: Valid sessionId but no active SSE stream
When: Client sends POST /mcp/messages
Then: Response is 202 Accepted
  And: Response includes: { queued: true, queuedAt: timestamp }
  And: Message is stored in pending queue
  And: When SSE stream reconnects, queued messages are delivered
```

---

### Requirement: Session Lifecycle Management

#### Requirement ID: `MCP-HTTP-004`

**Requirement Statement:**
The application SHALL manage session lifecycle with automatic cleanup for idle sessions.

**Acceptance Criteria:**
- Sessions timeout after 30 seconds of inactivity (configurable)
- Activity includes: POST /mcp/init, GET /sse connection, POST /mcp/messages
- Expired sessions return HTTP 410 Gone
- Cleanup removes SSE connections and message queues
- Maximum 100 pending messages per session

**Scenario: Session Expires**
```
Given: Active session with sessionId "abc-123"
When: No activity for 30 seconds
Then: Session is marked as expired
  And: Next request returns HTTP 410 Gone
  And: Session resources are released
```

**Scenario: Activity Resets Timeout**
```
Given: Existing session with 25s remaining timeout
When: Client sends POST /mcp/messages
Then: Timeout is reset to 30s
  And: Session remains active
```

---

### Requirement: Error Handling & Recovery

#### Requirement ID: `MCP-HTTP-005`

**Requirement Statement:**
The application SHALL gracefully handle connection failures and provide recovery mechanisms.

**Acceptance Criteria:**
- Dropped SSE connections trigger reconnect handling
- Message queue survives client disconnects (for 30s window)
- Duplicate requests are idempotent (same id returns cached result)
- Error responses include error code and description
- All error responses are JSON format

**Scenario: Connection Drops During Response**
```
Given: Client has active SSE stream
When: Network connection drops mid-response
Then: Server keeps session active
  And: Client can reconnect with GET /sse?session=xyz
  And: Pending messages are retransmitted
```

---

### Requirement: CORS & Security

#### Requirement ID: `MCP-HTTP-006`

**Requirement Statement:**
The application SHALL enforce CORS policies and prevent unauthorized access.

**Acceptance Criteria:**
- SSE endpoints include `Access-Control-Allow-Origin` header
- Default: allow all origins (configurable)
- Restricted origins are validated
- Sessions are isolated by sessionId (no cross-session access)
- No sensitive data leaked in error messages

**Scenario: Browser-Based Client**
```
Given: Browser-based MCP client from different origin
When: Client sends OPTIONS request to /sse
Then: Server responds with CORS headers
  And: Access-Control-Allow-Origin is set
  And: Client can proceed with GET /sse request
```

---

## MODIFIED Requirements

### Requirement: MCP Server Transport Selection

#### Requirement ID: `MCP-HTTP-101`

**Previous Requirement Statement:**
The MCP server MUST use stdio transport for communication.

**Modified Requirement Statement:**
The MCP server SHALL support multiple transport modes (stdio, HTTP/SSE) and automatically select the appropriate transport based on environment or configuration.

**Acceptance Criteria:**
- `MCP_TRANSPORT` env var supports: `stdio`, `http`, `auto`
- Default mode is `auto` (use stdio if available, else HTTP)
- Mode can be overridden via env var
- Transport selection logged on startup
- No breaking changes to existing stdio-based deployments

**Scenario: Auto-Detect Transport Mode (Local)**
```
Given: Application running in terminal with stdin available
When: MCP server initializes
Then: Transport mode is set to "stdio"
  And: Log message indicates: "MCP Transport: stdio"
```

**Scenario: Auto-Detect Transport Mode (Docker)**
```
Given: Application running in Docker container
When: MCP server initializes
Then: Transport mode is set to "http" (stdin not available)
  And: Log message indicates: "MCP Transport: http"
  And: SSE endpoints are ready for connections
```

---

### Requirement: Configuration Management

#### Requirement ID: `MCP-HTTP-102`

**Previous Requirement Statement:**
Configuration is loaded from environment variables and applied at startup.

**Modified Requirement Statement:**
Configuration SHALL support HTTP/SSE-specific parameters and validate transport-related settings.

**Acceptance Criteria:**
- New config parameters:
  - `MCP_TRANSPORT`: Transport mode selection
  - `MCP_SSE_BASE_URL`: Public URL for SSE endpoints
  - `SSE_SESSION_TIMEOUT`: Session idle timeout (seconds)
- Invalid values produce clear error messages
- Defaults are production-safe

**Scenario: Configure HTTP Transport**
```
Given: Admin wants to use HTTP transport
When: Admin sets MCP_TRANSPORT=http
Then: Configuration accepts and applies setting
  And: SSE endpoints are initialized
  And: No stdio transport is attempted
```

---

## Information Requirements

### Client Integration (Cursor)

Cursor MCP configuration for SSE connections:

```json
{
  "mcpServers": {
    "user-feedback": {
      "type": "sse",
      "url": "http://localhost:5050/sse",
      "initUrl": "http://localhost:5050/mcp/init",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Docker Integration

Docker Compose with SSE support:

```yaml
services:
  user-feedback-web:
    environment:
      - MCP_TRANSPORT=http
      - MCP_SSE_BASE_URL=http://user-feedback-web:5050
```

---

## Cross-References

- **Related Capability:** `remote-configuration` (environment variables)
- **Related Capability:** `docker-deployment` (containerization)
- **Related Spec:** `../../../specs/cli-config/spec.md`
