# Change Proposal: Add SSE Integration for Remote MCP Connectivity

**Change ID:** `add-sse-integration`  
**Status:** Proposed  
**Priority:** High  
**Target Version:** 3.1.0  
**Depends On:** `enhance-remote-docker`

## Overview

Add Server-Sent Events (SSE) and HTTP-based transport support to the MCP server, enabling remote clients (like Cursor, Claude Desktop, other AI editors) to connect to a containerized MCP server instance via HTTP(S) instead of requiring stdin/stdout communication.

### Objectives
1. **Enable HTTP-Based MCP Connectivity**: Support SSE transport for remote MCP access
2. **Dual-Mode Operation**: Support both stdio (local) and HTTP/SSE (remote) simultaneously
3. **Container-Ready**: Enable Cursor and other clients to connect to Docker-deployed instances
4. **Backward Compatible**: Maintain existing stdio transport; HTTP is additive

### Key User Stories
- **As a** developer, **I want** to connect Cursor to a Docker-containerized MCP server **so that** I can test remote feedback collection in a production-like environment
- **As a** system operator, **I want** MCP clients to connect via HTTPS to my containerized server **so that** I can integrate MCP tools across multiple machines securely
- **As an** AI editor user, **I want** to configure my MCP server address **so that** I can connect to local or remote feedback services

## Scope

### In Scope ✅
- SSE transport implementation (`/sse`, `/mcp` endpoints)
- HTTP message routing between MCP protocol and SSE transport
- CORS support for browser-based MCP clients
- Session-based SSE connection management
- Dual-mode initialization (stdio + HTTP)
- Graceful fallback if transport mode unavailable
- Docker Compose examples with SSE endpoints

### Out of Scope ❌
- WebSocket transport (future enhancement)
- OAuth/JWT authentication (use environment secrets)
- Rate limiting (implement as separate proposal)
- TLS/HTTPS termination (handled by reverse proxy)
- MCP tool modifications (transport is transparent to tools)

## Affected Capabilities

This change impacts:
1. **MCP HTTP Transport** (new)
2. **Web Server Routes** (modified)
3. **Docker Deployment** (modified)
4. **Configuration Management** (modified)

## Architecture Notes

### SSE Transport Design

```
HTTP Client                    Web Server               MCP Server
    │                             │                          │
    ├─ POST /mcp/init ────────────>                         │
    │                             │ create SSE session       │
    │                        ─────┴────────>               │
    │<────────── 200 OK ────────────────────────────────   │
    │ (session_id in body)                                 │
    │                                                       │
    ├─ GET /sse?session=xyz ────────────────>              │
    │ (open SSE connection)                               │
    │<────────────── 200 (text/event-stream) ─────────────│
    │                                                       │
    │ (MCP client connects)                               │
    ├─ POST /mcp/messages ──────────────>                 │
    │ (send JSON-RPC request via HTTP)                    │
    │                     forward via SSE ────────────────>│
    │                             │        ◄── MCP response
    │<─────────────event: message ─────────────────────────│
    │ (receive JSON-RPC response via SSE)                │
    │                                                       │
    └─ DELETE /mcp/close ──────────>                      │
      (close session)               close SSE             │
```

### Connection States

```
1. IDLE: No SSE connection
   ├─ POST /mcp/init → CREATE SESSION
   └─ Session registered but not connected

2. CONNECTED: SSE stream active
   ├─ GET /sse → Establish stream
   ├─ POST /mcp/messages → Forward via stream
   └─ DELETE /mcp/close → Cleanup session

3. CLEANUP: Session expired/closed
   ├─ Remove from active sessions
   ├─ Flush pending messages
   └─ Release resources
```

### Error Handling

```
Scenario: SSE client disconnects mid-request
  1. HTTP client sends: POST /mcp/messages
  2. Response starts streaming (200 OK, text/event-stream)
  3. Network breaks during stream
  4. Server: Retry with exponential backoff
  5. Client: Reconnect with GET /sse?session=xyz
  6. Server: Resume stream from last known position

Scenario: Session expires (30s idle timeout)
  1. No messages for 30s
  2. Server sends: event: ping
  3. Client responds: POST /mcp/ping
  4. If no response within 5s → close session
```

## Implementation Strategy

### Phase 1: Core SSE Transport
1. Create `src/server/sse-transport.ts` (SSE adapter for MCP messages)
2. Add `/sse` endpoint (GET with query param `?session=xyz`)
3. Add `/mcp/init` endpoint (initialize session)
4. Add `/mcp/messages` endpoint (POST to send, SSE stream to receive)

### Phase 2: Integration
1. Modify `src/server/mcp-server.ts` to support dual transports
2. Auto-detect based on environment (MCP_TRANSPORT=stdio|http|auto)
3. Add configuration for SSE URL and CORS

### Phase 3: Documentation & Testing
1. Update docker-compose.yml with SSE examples
2. Add Cursor MCP configuration examples
3. Test local + remote connectivity

## Timeline
- **Phase 1** (Days 1-2): SSE transport and endpoints
- **Phase 2** (Days 3-4): MCP server integration
- **Phase 3** (Days 5): Testing and documentation

## Dependencies
- No new npm dependencies
- `express` (already used)
- `uuid` (generate session IDs) - already available

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Network latency in SSE | Add client-side retry logic; configurable timeouts |
| Session management complexity | Use simple in-memory session store with cleanup timers |
| CORS issues with browser clients | Whitelist origins; document CORS configuration |
| Backward compatibility break | Stdio remains default; HTTP is opt-in via config |
| Resource leaks from stale SSE connections | Auto-cleanup on idle timeout (30s default) |

## Success Criteria
- [ ] SSE endpoints respond with correct MIME type (text/event-stream)
- [ ] MCP messages flow bidirectionally via HTTP
- [ ] Cursor can connect to containerized server via `{ type: "sse", url: "..." }`
- [ ] Sessions expire after idle timeout
- [ ] Zero breaking changes to stdio transport
- [ ] Docker Compose example demonstrates SSE usage
