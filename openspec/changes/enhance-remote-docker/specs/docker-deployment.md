# Specification: Docker Deployment & Optimization

**Capability ID:** `docker-deployment`  
**Components:** `Dockerfile`, `docker-compose.yml`, `.dockerignore`  
**Status:** Modified (Existing upgraded to v3.0.0 standards)

## Purpose
Provide production-ready Docker image with multi-stage builds, security hardening, health checks, and orchestration-friendly configuration for seamless containerized deployments.

## MODIFIED Requirements

### Requirement: Multi-Stage Docker Build
**ID:** `docker-multi-stage-build`

**Current (v2.1.3):** Single-stage Dockerfile includes dev dependencies (large image)  
**Modified (v3.0.0):** Multi-stage build separates compilation from runtime

#### Before (v2.1.3)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production  # Still includes dev toolchain in base image
COPY tsconfig.json src scripts ./
RUN npm run build
EXPOSE 3000 5555
CMD ["node", "dist/cli.js", "start"]
```
**Result:** ~400 MB image (includes TypeScript, ESLint, build tools)

#### After (v3.0.0)
```dockerfile
# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /build
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src scripts ./
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules
COPY package.json ./
RUN npm prune --production
ENV NODE_ENV=production
HEALTHCHECK ...
EXPOSE 5050 5555
CMD ["node", "dist/cli.js"]
```
**Result:** ~200 MB image (no build tools, minimal base)

**Acceptance Criteria:**
- [ ] Dockerfile uses `AS builder` stage pattern
- [ ] Dependencies installed once in builder
- [ ] Built artifacts copied to runtime stage
- [ ] Final image excludes: tsc, eslint, jest, build scripts
- [ ] Final image size < 250 MB
- [ ] Build time < 2 minutes on CI
- [ ] `docker build --no-cache` succeeds

---

### Requirement: Health Check Integration
**ID:** `docker-health-check`

**Current (v2.1.3):** Basic `HEALTHCHECK` present  
**Modified (v3.0.0):** Enhanced health endpoint with database verification

#### Docker Compose Health Check
```dockerfile
HEALTHCHECK \
  --interval=30s \
  --timeout=10s \
  --start-period=5s \
  --retries=3 \
  CMD node -e "require('http').get('http://localhost:5050/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

#### Health Endpoint Response
```json
{
  "status": "ok",
  "timestamp": "2025-10-20T14:30:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "memoryUsage": {
    "rss": 123456789,
    "heapUsed": 45678901
  },
  "port": 5050
}
```

#### Orchestrator Integration
- **Docker**: Marks container unhealthy after 3 consecutive failures
- **Kubernetes**: Detects via HTTP probe, triggers restarts
- **Docker Compose**: Enables `depends_on` health checks

**Acceptance Criteria:**
- [ ] `GET /health` returns 200 when ready
- [ ] `GET /health` returns 503 when database offline
- [ ] Response includes: status, timestamp, uptime, database state, memory
- [ ] Health check timeout < 10s
- [ ] Database connectivity verified before responding 200
- [ ] Endpoint accessible without authentication

---

### Requirement: Graceful Shutdown Handling
**ID:** `docker-graceful-shutdown`

**Current (v2.1.3):** Basic signal handling  
**Modified (v3.0.0):** Production-ready graceful shutdown for containers

#### Signal Handling
```typescript
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn(`Already shutting down, ignoring ${signal}`);
    return;
  }
  
  isShuttingDown = true;
  logger.info(`Received ${signal}, graceful shutdown initiated`);
  
  try {
    // 1. Stop accepting new connections
    this.server.close();
    
    // 2. Wait for in-flight requests (with timeout)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. Close WebSocket connections
    this.io.close();
    
    // 4. Flush logs
    await logger.flush();
    
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

#### Kubernetes StopGracePeriodSeconds
```yaml
terminationGracePeriodSeconds: 30  # Allow 30s for graceful shutdown
```

**Acceptance Criteria:**
- [ ] SIGTERM/SIGINT handlers registered
- [ ] No new connections accepted after signal
- [ ] In-flight requests allowed to complete (with timeout)
- [ ] WebSocket sessions notified before disconnect
- [ ] Logs flushed before exit
- [ ] Exit code 0 on success, 1 on error
- [ ] Shutdown completes within 30 seconds

---

### Requirement: Docker Compose Configuration
**ID:** `docker-docker-compose`

**Current (v2.1.3):** Basic services with fixed ports  
**Modified (v3.0.0):** Production-ready with networks, volumes, health checks, resource limits

#### Enhanced docker-compose.yml
```yaml
version: '3.8'

services:
  user-feedback-web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: user-feedback-web
    
    # Network configuration
    networks:
      - user-feedback-network
    
    # Port mapping
    ports:
      - "5050:5050"  # Web UI
      - "5555:5555"  # MCP server
    
    # Environment configuration
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - MCP_WEB_PORT=5050
      - MCP_SERVER_HOST=0.0.0.0
      - MCP_API_KEY=${MCP_API_KEY}
      - MCP_API_BASE_URL=https://api.ssopen.top
    
    # Data persistence
    volumes:
      - user-feedback-data:/app/data
      - /app/node_modules  # Prevent host override
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    
    # Restart policy
    restart: unless-stopped
    
    # Health checks
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5050/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

networks:
  user-feedback-network:
    driver: bridge

volumes:
  user-feedback-data:
    driver: local
```

**Acceptance Criteria:**
- [ ] Services on isolated network
- [ ] Data volume mounted at `/app/data`
- [ ] CPU/memory limits configured
- [ ] Health checks defined
- [ ] Environment variables externalized
- [ ] `depends_on` supports health checks (v3.9+)
- [ ] Docker Compose up/down works without data loss
- [ ] File permissions preserved for database

---

### Requirement: `.dockerignore` Optimization
**ID:** `docker-dockerignore`

**Current (v2.1.3):** May not exist or incomplete  
**Modified (v3.0.0):** Comprehensive file exclusion for faster builds

#### `.dockerignore` Contents
```
.git
.gitignore
.env.example
.env
.env.*.local
node_modules
dist
build
coverage
.jest_cache
.eslintcache
.npmignore
.cursor
.docs
.github
.vscode
README.md
LICENSE
*.log
*.md
.DS_Store
Thumbs.db
```

**Impact:**
- **Before:** Build context ~5 MB (includes node_modules, git history)
- **After:** Build context ~100 KB (source code only)
- **Build time:** 30% faster context upload to Docker daemon

**Acceptance Criteria:**
- [ ] `.dockerignore` committed to repo
- [ ] Excludes: node_modules, dist, .git, .env files
- [ ] Excludes: documentation, IDE configs, logs
- [ ] Build context reduced to source only
- [ ] Multi-stage build layer cache effective

---

## ADDED Requirements

### Requirement: Security Hardening
**ID:** `docker-security`

Docker images MUST follow security best practices.

#### Build-Time Security
```dockerfile
# Use specific version (not :latest)
FROM node:18.17.0-alpine

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app
RUN chown -R nodejs:nodejs /app

# Run as non-root
USER nodejs
```

#### Runtime Security
- No secrets in image (all from env vars)
- Read-only root filesystem (where possible)
- Resource limits enforced
- No build tools included

#### Security Scanning
```bash
# Scan with Trivy
trivy image user-feedback-web:latest

# Scan with Docker Scout
docker scout cves --baseline latest
```

**Acceptance Criteria:**
- [ ] Non-root user runs container
- [ ] No secrets hardcoded
- [ ] Image scanned for vulnerabilities before release
- [ ] Base image kept updated (weekly patch checks)
- [ ] SBOM (Software Bill of Materials) available

---

### Requirement: Dockerfile Documentation
**ID:** `docker-dockerfile-docs`

Dockerfile MUST include clear labels and documentation.

#### Labels
```dockerfile
LABEL org.opencontainers.image.title="MCP User Feedback Web"
LABEL org.opencontainers.image.description="Feedback collector for AI agents via MCP"
LABEL org.opencontainers.image.version="3.0.0"
LABEL org.opencontainers.image.source="https://github.com/HyperHeroX/user-feedback-web"
LABEL org.opencontainers.image.authors="User-Feedback Team"
```

**Acceptance Criteria:**
- [ ] OCI labels present
- [ ] Image title and description clear
- [ ] Version matches package.json
- [ ] Source repository linked
- [ ] Authors credited

---

## Usage Examples

### Build Locally
```bash
docker build -t user-feedback-web:latest .
```

### Run Standalone
```bash
docker run \
  -e MCP_API_KEY=sk-... \
  -e LOG_LEVEL=debug \
  -v user-feedback-data:/app/data \
  -p 5050:5050 \
  -p 5555:5555 \
  user-feedback-web:latest
```

### Docker Compose Stack
```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f user-feedback-web

# Health check
docker-compose exec user-feedback-web curl http://localhost:5050/health

# Stop gracefully
docker-compose down  # Waits for graceful shutdown
```

### Kubernetes Deployment (Future)
```yaml
spec:
  containers:
  - name: user-feedback-web
    image: user-feedback-web:3.0.0
    ports:
    - containerPort: 5050
      name: http
    - containerPort: 5555
      name: mcp
    env:
    - name: MCP_API_KEY
      valueFrom:
        secretKeyRef:
          name: feedback-secrets
          key: api-key
    livenessProbe:
      httpGet:
        path: /health
        port: 5050
      initialDelaySeconds: 10
      periodSeconds: 30
    readinessProbe:
      httpGet:
        path: /health
        port: 5050
      initialDelaySeconds: 5
      periodSeconds: 10
```

---

## Related Capabilities
- `remote-configuration`: Environment variables referenced in Docker Compose
- `health-observability`: Health check endpoint and metrics
- `graceful-shutdown`: Signal handling in container

---

## Testing Requirements
- [ ] Multi-stage build reduces image size by 50%+
- [ ] Container starts within 5 seconds
- [ ] Health check endpoint responds correctly
- [ ] Graceful shutdown on SIGTERM (< 10s)
- [ ] Data persists across container restarts
- [ ] Docker Compose stack deploys without errors
- [ ] Security scan: no critical vulnerabilities
