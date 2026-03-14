# Design Document: Remote Deployment & Docker Enhancement

**Change ID:** `enhance-remote-docker`

## Architectural Overview

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Remote Deployment                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AI Agent / MCP Client                               │  │
│  │  (Local or Remote)                                   │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│                   │ MCP Protocol (stdio)                     │
│                   │                                          │
│  ┌────────────────┴─────────────────────────────────────┐  │
│  │  MCP Server (in Container)                           │  │
│  │  Port: 5555 (configurable)                           │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   │                                          │
│    ┌──────────────┴──────────────┐                          │
│    │                             │                          │
│  Socket.IO (Session mgmt)   HTTP/WebSocket                 │
│    │                             │                          │
│  ┌─┴──────────────────────────────┴────────────────────┐  │
│  │  Web Server (Port 5050)                             │  │
│  │  ├─ Feedback UI                                     │  │
│  │  ├─ REST API (/api/*)                               │  │
│  │  ├─ WebSocket (Session management)                  │  │
│  │  └─ Health Check (/health)                          │  │
│  └──┬───────────────────────────────────────────────────┘  │
│     │                                                        │
│  SQLite DB                                                  │
│  /app/data/feedback.db                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Remote Deployment Environment:
- Docker: Container isolation and resource limits
- Docker Compose: Multi-service orchestration
- Kubernetes: (Future) Auto-scaling and resilience
```

### Configuration Flow

```
Environment Variables
     │
     ├─ MCP_WEB_PORT (default: 5050)
     ├─ MCP_SERVER_HOST (default: localhost)
     ├─ MCP_SERVER_BASE_URL (optional: override URL generation)
     ├─ MCP_API_KEY (API credentials)
     ├─ LOG_LEVEL (logging verbosity)
     └─ (other MCP_* and NODE_ENV settings)
     │
     ▼
Config Validation
     │
     ├─ Check port range (1024-65535)
     ├─ Validate API keys
     ├─ Verify URLs are valid
     └─ Log configuration (masked secrets)
     │
     ▼
WebServer Initialization
     │
     ├─ Start Express + Socket.IO
     ├─ Initialize Database
     ├─ Load session handlers
     └─ Ready for connections
     │
     ▼
Health Check Endpoint (/health)
     │
     └─ Returns 200 if ready
```

## Docker Image Strategy

### Multi-Stage Build

**Stage 1: Builder**
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /build
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY scripts ./scripts
RUN npm run build
```

**Stage 2: Runtime**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY static ./static
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5050/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
EXPOSE 5050 5555
CMD ["node", "dist/cli.js"]
```

### Benefits
- **Size**: ~150-200 MB final image (vs ~400 MB with dev deps)
- **Security**: No build tools in runtime image
- **Layer efficiency**: Separates build from runtime
- **Caching**: Dependencies cached separately from source

## Configuration Management

### Environment Variable Hierarchy

```
1. Explicit Environment Variables (highest priority)
   MCP_WEB_PORT=5050
   MCP_SERVER_HOST=0.0.0.0
   MCP_API_KEY=sk-...

2. .env File (for local development)
   MCP_WEB_PORT=5050
   MCP_DIALOG_TIMEOUT=60

3. Default Values (in config/index.ts)
   webPort = 5050
   serverHost = 'localhost'
   dialogTimeout = 60

4. Validation & Fail-Fast
   - Invalid port? → Error + exit
   - Missing API key? → Warning (if required)
   - Invalid URLs? → Error + exit
```

### Docker Compose Variables

```yaml
services:
  user-feedback-web:
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - MCP_WEB_PORT=5050
      - MCP_SERVER_HOST=0.0.0.0  # Listen on all interfaces
      - MCP_API_KEY=${MCP_API_KEY}  # Pass from host .env
      - MCP_API_BASE_URL=https://api.ssopen.top
```

## Remote Access Design

### URL Generation Logic

**Current (v2.1.3)**
```typescript
const host = this.config.serverHost || 'localhost';
return `http://${host}:${this.port}`;
```

**Enhanced (v3.0.0)**
```typescript
// Priority: 1. Config override > 2. Derived > 3. Default
if (this.config.serverBaseUrl) {
  return this.config.serverBaseUrl;  // e.g., https://feedback.example.com
}

const host = this.config.serverHost || 'localhost';
const scheme = this.config.useHttps ? 'https' : 'http';
return `${scheme}://${host}:${this.port}`;
```

### Network Accessibility

**Local Development**
```bash
# Docker container listens on localhost:5050
# Accessible via http://localhost:5050
curl http://localhost:5050/health
```

**Docker Compose (Internal Network)**
```bash
# Container listens on 0.0.0.0:5050
# Accessible via http://user-feedback-web:5050 (from other services)
# Or http://localhost:5050 from host
```

**Remote Deployment**
```bash
# Container listens on 0.0.0.0:5050
# Port published: 5050:5050 or mapped to 80/443
# Accessible via https://feedback.example.com
# Set MCP_SERVER_BASE_URL=https://feedback.example.com
```

## Health Checks & Observability

### HTTP Health Check Endpoint

```typescript
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealthy ? 'connected' : 'failed',
    memoryUsage: process.memoryUsage(),
    port: this.port
  };
  res.status(dbHealthy ? 200 : 503).json(health);
});
```

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5050/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

**Behavior:**
- **Starting** (5s): Allow startup time
- **Healthy**: Responds with 200
- **Unhealthy**: Responds with 503 or timeout
- **Action**: After 3 failures, container marked unhealthy
- **Orchestrator Response**: Restart or remove container

### Logging for Container Orchestration

```typescript
// Structured logging for container orchestrators
logger.info('Application started', {
  port: this.port,
  environment: process.env.NODE_ENV,
  version: VERSION
});

// On graceful shutdown
logger.info('Shutting down gracefully', { reason: signal });
```

## Graceful Shutdown

### Signal Handling in Container

```typescript
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`Already shutting down, ignoring ${signal}`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    // 1. Stop accepting new connections
    this.server.close();
    
    // 2. Close WebSocket connections
    this.io.close();
    
    // 3. Flush logs and cleanup
    await logger.flush();
    
    // 4. Exit cleanly
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### Timeline
- **SIGTERM received**: 30-second grace period begins
- **Existing requests**: Continue until completion
- **New requests**: Rejected with 503
- **Active WebSocket sessions**: Notify client, allow graceful disconnect
- **Timeout**: Forceful exit after 30s

## Security Considerations

### Remote Access Security
- **HTTPS**: Use reverse proxy (nginx, Caddy) or `MCP_USE_HTTPS`
- **Authentication**: (Future) API key validation per session
- **CORS**: Restrict to known origins in production
- **Secrets**: Never log API keys; use environment variables

### Container Security
- **Alpine base**: Minimal attack surface
- **Non-root**: Run as `node` user (not root)
- **Read-only root**: Mount filesystem as read-only where possible
- **Resource limits**: Set CPU/memory limits in Docker Compose
- **Network**: Isolate containers on private networks

## Performance & Scalability

### Horizontal Scaling Pattern

```
┌─────────────────┐
│  Load Balancer  │
│  (nginx/HAProxy)│
└────────┬────────┘
         │
    ┌────┴────────────┐
    │                 │
┌───▼────────┐  ┌─────▼───────┐
│ Container 1│  │ Container 2 │
│ (MCP)      │  │ (MCP)       │
│ Port:5555  │  │ Port:5555   │
└───┬────────┘  └─────┬───────┘
    │ Shared          │
    └─────┬───────────┘
          ▼
    ┌──────────────────┐
    │  Shared Volume   │
    │  /data (SQLite)  │
    └──────────────────┘
```

**Considerations:**
- Shared SQLite DB via network volume (NFS, SMB)
- Sticky sessions: Route user to same container
- Health checks: Verify all replicas before accepting traffic

### Memory & CPU Limits

```yaml
services:
  user-feedback-web:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## Testing Strategy for Remote & Docker

### Unit Tests
- Config validation logic
- Health check endpoint
- Graceful shutdown signal handling

### Integration Tests (Docker)
```bash
# Build and test in Docker
docker build -t user-feedback-web:test .
docker run --rm -e LOG_LEVEL=debug user-feedback-web:test npm test
```

### End-to-End Tests (Docker Compose)
```bash
# Deploy full stack
docker-compose up -d
# Wait for health checks
sleep 10
# Test feedback flow
curl http://localhost:5050/health
```

### Performance Tests
- Load test: 50+ concurrent WebSocket connections
- Stress test: Rapid session creation/destruction
- Memory test: Long-running stability over 24 hours

## Migration Path from v2.1.3

### Backward Compatibility
- **CLI**: Maintain existing `npm start` behavior
- **Env vars**: New vars are optional; defaults preserve v2 behavior
- **Config**: Non-breaking additions only

### Migration Guide
```
v2.1.3 → v3.0.0:

1. Update package.json
   npm install user-web-feedback@3.0.0

2. Docker Compose
   - Update image tag
   - Add MCP_SERVER_HOST=0.0.0.0 for remote access
   - No breaking changes to service definition

3. Environment
   - Add MCP_SERVER_BASE_URL if accessing from remote networks
   - Existing MCP_WEB_PORT, MCP_API_KEY work unchanged
```

## Tooling & Documentation

### CLI Changes
```bash
# Existing (still works)
npm run start

# New environment-driven approach
MCP_WEB_PORT=5050 MCP_SERVER_HOST=0.0.0.0 npm run start

# Docker
docker run -e MCP_WEB_PORT=5050 user-feedback-web:latest
```

### Documentation Structure
- **README.md**: Quick start (local + Docker)
- **docs/DOCKER_GUIDE.md**: Docker best practices, Compose examples
- **docs/REMOTE_DEPLOYMENT.md**: Remote configuration, reverse proxy setup
- **docs/ENV_VARS.md**: Complete environment variable reference
- **docs/ORCHESTRATION.md**: Kubernetes readiness (future)
