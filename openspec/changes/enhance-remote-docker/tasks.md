# Implementation Tasks: Enhance Remote Deployment & Docker Support

**Change ID:** `enhance-remote-docker`  
**Target Version:** 3.0.0  
**Estimated Duration:** 2-3 weeks

## Phase 1: Remote Configuration (Week 1)

### Task 1.1: Extend Configuration Schema
- [ ] Add to `src/types/index.ts`:
  - `serverHost?: string` (default: 'localhost')
  - `serverBaseUrl?: string` (optional override)
  - `useHttps?: boolean` (default: false)
- [ ] Add validation rules for new fields
- **Validation Criteria:**
  - `serverHost` must be valid hostname or IP
  - `serverBaseUrl` must be valid HTTP/HTTPS URL
  - `useHttps` must be boolean
- **Ticket:** `ENH-001`

### Task 1.2: Update Configuration Loading
- [ ] Modify `src/config/index.ts`:
  - Extract `MCP_SERVER_HOST` from env
  - Extract `MCP_SERVER_BASE_URL` from env
  - Extract `MCP_USE_HTTPS` from env
  - Add validation with clear error messages
- [ ] Update `validateConfig()` function
- [ ] Add helpful error messages for invalid configs
- **Test Locally:**
  ```bash
  MCP_SERVER_HOST=invalid MCP_USE_HTTPS=not-bool npm run start
  # Should exit with clear error message
  ```
- **Ticket:** `ENH-002`

### Task 1.3: Update URL Generation Logic
- [ ] Modify `src/server/web-server.ts`:
  - Update `generateFeedbackUrl()` method
  - Priority: serverBaseUrl > derived > default
  - Use `MCP_USE_HTTPS` flag for scheme
- [ ] Add comprehensive logging of config
- [ ] Log on startup: host, port, https, derived URL
- **Test:**
  ```bash
  MCP_SERVER_BASE_URL=https://feedback.example.com npm run start
  # Should generate URLs: https://feedback.example.com/?mode=feedback&session=xxx
  ```
- **Ticket:** `ENH-003`

### Task 1.4: Add Startup Configuration Logging
- [ ] Log all configuration values on startup
- [ ] Mask API keys and secrets
- [ ] Format: structured with context
- **Example Output:**
  ```
  [INFO] Configuration loaded:
    - Server Host: 0.0.0.0
    - Web Port: 5050
    - HTTPS: false
    - Base URL: http://localhost:5050
  ```
- **Ticket:** `ENH-004`

### Task 1.5: Update CLI Help Text
- [ ] Modify `src/cli.ts` help output
- [ ] Document new environment variables
- [ ] Add examples for different deployment scenarios
- **Ticket:** `ENH-005`

---

## Phase 2: Health Checks & Observability (Week 1-2)

### Task 2.1: Implement Health Check Endpoint
- [ ] Add `GET /health` endpoint in `src/server/web-server.ts`
- [ ] Response includes:
  - `status` (ok/degraded)
  - `timestamp` (ISO 8601)
  - `uptime` (seconds)
  - `database` (connected/offline)
  - `memoryUsage` (RSS, heap)
  - `port` and `version`
- [ ] Status: 200 if healthy, 503 if degraded
- **Unit Test:**
  ```typescript
  test('GET /health returns 200 when healthy', async () => {
    const res = await fetch('http://localhost:5050/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
  });
  ```
- **Ticket:** `ENH-006`

### Task 2.2: Add Metrics Collection
- [ ] Create `src/utils/metrics-collector.ts`
- [ ] Track: requests, errors, response times, websocket connections
- [ ] Calculate percentiles: p50, p95, p99
- [ ] Add `GET /api/metrics` endpoint
- **Acceptance Criteria:**
  - Metrics accurate within 5%
  - Collection overhead < 1% CPU
  - Memory overhead < 10 MB
- **Ticket:** `ENH-007`

### Task 2.3: Enhance Structured Logging
- [ ] Update `src/utils/logger.ts`:
  - JSON output format
  - Include timestamp, level, logger name, context
  - Mask API keys in all output
- [ ] Add log levels: error, warn, info, debug
- [ ] Update all log calls for consistency
- **Integration Test:**
  ```bash
  LOG_LEVEL=info npm run start 2>&1 | jq '.level'
  # Should output: "info"
  ```
- **Ticket:** `ENH-008`

### Task 2.4: Implement Graceful Shutdown
- [ ] Register SIGTERM/SIGINT handlers in `src/server/web-server.ts`
- [ ] Logic:
  1. Stop accepting new connections
  2. Wait for in-flight requests (5s timeout)
  3. Close WebSocket connections
  4. Flush logs
  5. Exit with code 0
- [ ] Test: Signal handling completes within 10s
- **Unit Test:**
  ```typescript
  test('Graceful shutdown on SIGTERM', async () => {
    // Send SIGTERM
    // Verify: no new connections accepted
    // Verify: existing requests complete
    // Verify: exit code 0
  });
  ```
- **Ticket:** `ENH-009`

---

## Phase 3: Docker Optimization (Week 2)

### Task 3.1: Multi-Stage Dockerfile
- [ ] Create builder stage:
  - Install all dependencies
  - Run build (tsc, copy-static)
- [ ] Create runtime stage:
  - Copy only dist, node_modules, package.json
  - No dev dependencies
- [ ] Add health check
- [ ] Add OCI labels
- **Acceptance Criteria:**
  - Final image < 250 MB
  - Build time < 2 minutes
  - No dev tooling in runtime image
  - `docker build` succeeds without warnings
- **Ticket:** `ENH-010`

### Task 3.2: Optimize .dockerignore
- [ ] Create comprehensive `.dockerignore`
- [ ] Exclude: node_modules, dist, .git, .env, docs, etc.
- [ ] Verify: build context < 200 KB
- **Check:**
  ```bash
  docker build --no-cache --progress=plain . 2>&1 | grep "COPY src" | grep -o "[0-9.]*MB"
  # Should be < 200 KB
  ```
- **Ticket:** `ENH-011`

### Task 3.3: Create Production Dockerfile
- [ ] Non-root user execution
- [ ] Security best practices applied
- [ ] Security scanning passes (no critical vulnerabilities)
- [ ] `docker build -t user-feedback-web:3.0.0 .` succeeds
- **Ticket:** `ENH-012`

### Task 3.4: Enhance Docker Compose
- [ ] Network configuration (isolated)
- [ ] Volume configuration (data persistence)
- [ ] Resource limits: CPU/Memory
- [ ] Health checks
- [ ] Environment variables setup
- [ ] Restart policy
- **Test:**
  ```bash
  docker-compose up -d
  sleep 10
  docker-compose exec user-feedback-web curl http://localhost:5050/health
  docker-compose down
  ```
- **Ticket:** `ENH-013`

### Task 3.5: Update Build Scripts
- [ ] Ensure `npm run build` optimized for Docker
- [ ] Skip dev-only steps if needed
- [ ] Verify build artifacts in Docker context
- **Ticket:** `ENH-014`

---

## Phase 4: Documentation & Testing (Week 2-3)

### Task 4.1: Create Docker Guide
- [ ] `docs/DOCKER_GUIDE.md`:
  - Local Docker development
  - Docker Compose deployment
  - Common issues and troubleshooting
  - Performance tuning
- [ ] Include examples and commands
- **Ticket:** `ENH-015`

### Task 4.2: Create Remote Deployment Guide
- [ ] `docs/REMOTE_DEPLOYMENT.md`:
  - Configuration options
  - Reverse proxy setup (nginx example)
  - Kubernetes readiness (future reference)
  - Security best practices
- **Ticket:** `ENH-016`

### Task 4.3: Environment Variable Reference
- [ ] `docs/ENV_VARS.md`:
  - All new `MCP_*` variables documented
  - Examples for each
  - Defaults and validation rules
- **Ticket:** `ENH-017`

### Task 4.4: Unit Test Coverage
- [ ] Tests for remote configuration:
  - Valid/invalid host, port, URL
  - URL generation logic
- [ ] Tests for health endpoint
- [ ] Tests for metrics collection
- [ ] Tests for graceful shutdown
- **Coverage Target:** > 85%
- **Ticket:** `ENH-018`

### Task 4.5: Integration Tests
- [ ] Docker build and run
- [ ] Docker Compose stack (up/down)
- [ ] Health checks in container
- [ ] Data persistence across restarts
- [ ] Graceful shutdown in Docker
- **Ticket:** `ENH-019`

### Task 4.6: Performance Tests
- [ ] Load test: 50+ concurrent sessions in Docker
- [ ] Memory stability: 24-hour run
- [ ] Response time under load: p99 < 500ms
- [ ] Image size verification: < 250 MB
- **Ticket:** `ENH-020`

---

## Phase 5: Release Preparation (Week 3)

### Task 5.1: Update Version & Documentation
- [ ] Bump `package.json` version to 3.0.0
- [ ] Update `CHANGELOG.md` with all changes
- [ ] Update `README.md` with Docker sections
- **Ticket:** `ENH-021`

### Task 5.2: Security Audit
- [ ] Run Docker vulnerability scanner (Trivy)
- [ ] Check for secrets in code/docs
- [ ] Review new environment handling
- [ ] SBOM generation
- **Ticket:** `ENH-022`

### Task 5.3: Compatibility Testing
- [ ] Test with Docker 20.10+
- [ ] Test with Docker Compose 1.29+
- [ ] Test on Linux, macOS, Windows (WSL2)
- **Ticket:** `ENH-023`

### Task 5.4: Release Artifacts
- [ ] Create Git tag: `v3.0.0`
- [ ] Build and push Docker image
- [ ] Publish npm package
- [ ] Create GitHub release
- **Ticket:** `ENH-024`

---

## Dependencies & Parallelization

### Task Dependencies
```
1.1 → 1.2 → 1.3 → 1.4 → 1.5
                ↓
              2.1 → 2.2 → 2.3 → 2.4
                ↓
              3.1 → 3.2 → 3.3 → 3.4 → 3.5
                ↓
              4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6
                ↓
              5.1 → 5.2 → 5.3 → 5.4
```

### Parallelizable Work
- **Phase 1 & 2 can overlap**: Config (1.x) and health checks (2.x) independent
- **Documentation can start early**: Begin docs (4.1-4.3) while coding (3.x)
- **Tests can be written before code**: TDD approach for 4.4-4.6

### Estimated Timeline
- **Phase 1:** 3-4 days
- **Phase 2:** 4-5 days (overlaps with Phase 1)
- **Phase 3:** 3-4 days
- **Phase 4:** 4-5 days (overlaps with Phase 3)
- **Phase 5:** 2-3 days
- **Total:** 2-3 weeks (with parallel work)

---

## Validation Checklist

Before marking task complete:
- [ ] Code follows project conventions (naming, style)
- [ ] No lint errors: `npm run lint`
- [ ] All tests pass: `npm test`
- [ ] No security issues: `npm audit`
- [ ] TypeScript compilation succeeds: `npm run build`
- [ ] Docker build succeeds (if applicable)
- [ ] Logs contain no hardcoded secrets
- [ ] Documentation updated if needed

---

## Rollback Plan

If deployment fails:
1. Revert to v2.1.3 tag
2. Stop all v3.0.0 containers
3. Investigate failure in staging environment
4. Fix and re-test before retry

---

## Post-Release Monitoring

After release, monitor for 48 hours:
- Error rate in production
- Response time trends
- Memory stability
- Docker image pull metrics
- User-reported issues on GitHub
