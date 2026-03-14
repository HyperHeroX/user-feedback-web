# Specification: Health Checks & Observability

**Capability ID:** `health-observability`  
**Components:** `server/web-server.ts`, `utils/logger.ts`, Middleware  
**Status:** New

## Purpose
Provide comprehensive health checks and structured logging for container orchestration systems and monitoring, enabling production-grade observability and automated incident response.

## ADDED Requirements

### Requirement: HTTP Health Check Endpoint
**ID:** `health-http-endpoint`

The system MUST provide an HTTP health check endpoint for container orchestrators and load balancers.

#### Endpoint Specification
- **Path:** `GET /health`
- **Authentication:** None required
- **Response Format:** JSON
- **Status Codes:**
  - `200 OK`: System fully healthy
  - `503 Service Unavailable`: System degraded (database offline)
  - `500 Internal Server Error`: Unexpected error

#### Response Schema (Healthy)
```json
{
  "status": "ok",
  "timestamp": "2025-10-20T14:30:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "memoryUsage": {
    "rss": 123456789,
    "heapUsed": 45678901,
    "heapTotal": 134217728,
    "external": 12345678
  },
  "port": 5050,
  "version": "3.0.0"
}
```

#### Response Schema (Degraded - Database Offline)
```json
{
  "status": "degraded",
  "timestamp": "2025-10-20T14:30:05.000Z",
  "uptime": 3605,
  "database": "offline",
  "reason": "Cannot connect to SQLite database",
  "port": 5050,
  "version": "3.0.0"
}
```

#### Scenarios

**Scenario: Fresh Start**
```
Request: GET /health
Container startup: 2 seconds
Response: 503 (still initializing)
→ Docker health check: Waiting for start_period
```

**Scenario: Normal Operation**
```
Request: GET /health
After initialization
Response: 200 OK with uptime, memory stats
→ Docker health check: Passes
→ Kubernetes: Ready to accept traffic
```

**Scenario: Database Failure**
```
Request: GET /health
SQLite database cannot be opened
Response: 503 Degraded with reason
→ Docker health check: Fails, triggers restart
→ Kubernetes: Removes from load balancer
```

**Scenario: OOM Condition**
```
Request: GET /health
Memory usage > 80% of limit
Response: 200 (still responding) with elevated memory metrics
→ Monitoring system: Alerts on memory trend
→ Operator: Scales up or investigates leak
```

**Acceptance Criteria:**
- [ ] Endpoint responds in < 100ms
- [ ] Returns 200 when all systems operational
- [ ] Returns 503 when database unavailable
- [ ] Response includes: status, timestamp, uptime, memory, port, version
- [ ] No authentication required
- [ ] Accessible before application fully initializes
- [ ] Graceful degradation (responds even under load)

---

### Requirement: Structured Logging for Container Orchestration
**ID:** `health-structured-logging`

The system MUST output structured logs compatible with container log aggregators (JSON format, severity levels).

#### Log Format
```json
{
  "timestamp": "2025-10-20T14:30:00.000Z",
  "level": "info",
  "logger": "web-server",
  "message": "Web server started",
  "context": {
    "port": 5050,
    "host": "0.0.0.0",
    "environment": "production"
  }
}
```

#### Log Levels
- `error`: Application error requiring investigation
- `warn`: Unusual but recoverable condition
- `info`: Significant lifecycle event (startup, shutdown)
- `debug`: Detailed diagnostic information
- `silent`: Suppress all logs (not used in containers)

#### Key Startup Events
```
[INFO] Configuration validated
[INFO] Database initialized: /app/data/feedback.db
[INFO] Web server listening on 0.0.0.0:5050
[INFO] Remote configuration:
  - Server Host: 0.0.0.0
  - Web Port: 5050
  - HTTPS: false
  - Base URL: http://localhost:5050
[INFO] Application ready
```

#### Key Shutdown Events
```
[INFO] Received SIGTERM
[INFO] Closing HTTP server
[INFO] Closing WebSocket connections: 3 active
[INFO] Flushing logs
[INFO] Graceful shutdown complete
```

#### Secret Masking
All sensitive data MUST be masked in logs:
```typescript
// ❌ Wrong
[INFO] API Key configured: sk-abc123def456
logger.info('Configuration:', { apiKey: 'sk-abc123def456' });

// ✅ Correct
[INFO] API Key configured: sk-***...***
logger.info('Configuration:', { apiKeyMasked: maskApiKey('sk-abc123def456') });
```

**Scenarios:**

**Scenario: Normal Startup**
```
[INFO] Starting application v3.0.0
[INFO] Environment: production
[INFO] Database initialized successfully
[INFO] Web server listening on 0.0.0.0:5050
[INFO] Application ready for requests
```

**Scenario: Configuration Error**
```
[ERROR] Configuration validation failed
[ERROR] Invalid port number: 99999
[ERROR] Must be between 1024 and 65535
[ERROR] Application exiting with code 1
```

**Scenario: Runtime Error**
```
[WARN] Database connection lost
[WARN] Attempting reconnect...
[WARN] Reconnect attempt 1/5
[ERROR] Reconnect failed: EACCES
[ERROR] Database offline, responding 503 to health checks
```

**Scenario: Shutdown**
```
[INFO] Received SIGTERM signal
[INFO] Graceful shutdown initiated
[INFO] Terminating 2 active WebSocket connections
[INFO] Closing HTTP server (5s grace period)
[INFO] Graceful shutdown complete (exit 0)
```

**Acceptance Criteria:**
- [ ] All startup logs include: level, timestamp, message, context
- [ ] No secrets logged (API keys, tokens masked)
- [ ] Shutdown logged with reason and timeline
- [ ] Errors include: error code, message, remediation hint
- [ ] JSON structured format for log parsing
- [ ] Compatible with: Docker logs, Kubernetes logs, ELK stack, Datadog

---

### Requirement: Memory & Performance Metrics
**ID:** `health-performance-metrics`

The system MUST track and expose performance metrics for monitoring.

#### Metrics Tracked
```typescript
interface PerformanceMetrics {
  requestsTotal: number;           // Total HTTP requests
  requestsSuccess: number;         // 2xx responses
  requestsError: number;           // 4xx/5xx responses
  requestsDuration: number[];      // Response times (ms)
  websocketConnections: number;    // Active WS connections
  sessionsCreated: number;         // Total feedback sessions
  sessionsCompleted: number;       // Sessions with feedback
  avgResponseTime: number;         // Mean response time
  p95ResponseTime: number;         // 95th percentile
  p99ResponseTime: number;         // 99th percentile
  memoryUsage: NodeJS.MemoryUsage; // V8 memory stats
  uptime: number;                  // Process uptime (seconds)
}
```

#### Metrics Endpoint
```typescript
app.get('/api/metrics', (req, res) => {
  const metrics = performanceMonitor.getMetrics();
  res.json(metrics);
});
```

#### Prometheus Export (Future)
```
# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 50
http_request_duration_seconds_bucket{le="0.5"} 95
http_request_duration_seconds_bucket{le="1"} 100

# HELP websocket_connections_active Active WebSocket connections
# TYPE websocket_connections_active gauge
websocket_connections_active 5
```

**Scenarios:**

**Scenario: Normal Operation**
```
GET /api/metrics

{
  "requestsTotal": 1000,
  "requestsSuccess": 990,
  "requestsError": 10,
  "avgResponseTime": 45,
  "p95ResponseTime": 120,
  "p99ResponseTime": 250,
  "websocketConnections": 3,
  "sessionsCreated": 50,
  "sessionsCompleted": 48,
  "memoryUsage": {
    "rss": 123456789,
    "heapUsed": 45678901
  },
  "uptime": 86400
}
```

**Scenario: Performance Degradation**
```
Monitoring alert triggered:
- p95ResponseTime: 1200ms (2x expected)
- requestsError: 150 (↑ from 10)
→ Alert sent to ops team
→ Operator investigates database load
```

**Acceptance Criteria:**
- [ ] Metrics collected continuously
- [ ] `/api/metrics` endpoint returns current state
- [ ] Memory stats include: RSS, heap used, external
- [ ] Response time percentiles calculated (p50, p95, p99)
- [ ] WebSocket connection count tracked
- [ ] Session lifecycle tracked (created, completed)
- [ ] Compatible with monitoring tools (Prometheus, CloudWatch)

---

### Requirement: Readiness & Liveness Probes
**ID:** `health-k8s-probes`

The system MUST support Kubernetes-style readiness and liveness probes.

#### Liveness Probe (Is the app alive?)
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 5050
  initialDelaySeconds: 15      # Wait 15s after start
  periodSeconds: 30            # Check every 30s
  timeoutSeconds: 5            # Timeout after 5s
  failureThreshold: 3          # Restart after 3 failures
```

**Failure Response:**
- Kubernetes: Restarts the pod
- Expected recovery: 30-60 seconds

#### Readiness Probe (Is the app ready for traffic?)
```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 5050
  initialDelaySeconds: 5       # Check after 5s
  periodSeconds: 10            # Check every 10s
  timeoutSeconds: 3
  failureThreshold: 2          # Remove from service after 2 failures
```

**Failure Response:**
- Kubernetes: Removes from load balancer
- Expected recovery: App fixes issue, readiness probe passes
- Impact: Requests redirected to other pods

#### Scenario: Database Comes Online
```
1. Container starts
2. Database connection fails (startup)
3. Readiness probe: 503 → Pod not ready
4. Load balancer: Routes traffic to other pods
5. Database comes online (operator fixes)
6. Readiness probe: 200 → Pod ready again
7. Load balancer: Resumes routing traffic to this pod
```

#### Scenario: Memory Leak Detected
```
1. Pod running normally (6h)
2. Memory usage increasing gradually
3. Monitoring alert: Memory > 80%
4. Readiness probe still 200 (app responsive)
5. Liveness probe still 200 (app alive)
6. Operator scales up or investigates
7. After investigation: Delete pod → Kubernetes recreates fresh pod
```

**Acceptance Criteria:**
- [ ] Liveness probe supports initial delay (app startup time)
- [ ] Readiness probe returns 200 only when fully initialized
- [ ] Both probes handle timeout gracefully
- [ ] Probe response time < 2 seconds
- [ ] Compatible with Kubernetes 1.20+

---

### Requirement: Container Lifecycle Hooks
**ID:** `health-container-hooks`

The system MUST integrate with container lifecycle events for graceful transitions.

#### preStop Hook (Kubernetes)
```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]
```

**Timeline:**
```
1. Kubernetes sends SIGTERM
2. preStop hook executes: sleep 5 (grace period)
3. App has 5 seconds to finish in-flight requests
4. SIGKILL sent if not exited after terminationGracePeriodSeconds (30s total)
5. Pod terminates
```

#### postStart Hook (Kubernetes)
```yaml
lifecycle:
  postStart:
    httpGet:
      path: /health
      port: 5050
```

**Not typically needed for stateless services**

**Acceptance Criteria:**
- [ ] App handles SIGTERM without data loss
- [ ] In-flight requests complete within grace period
- [ ] WebSocket connections closed gracefully
- [ ] Database connections properly closed
- [ ] Logs flushed before exit

---

## Related Capabilities
- `remote-configuration`: Health endpoint accessible via configured port/host
- `docker-deployment`: Health check integrated in Dockerfile and Docker Compose
- `graceful-shutdown`: Signal handling coordinates with health checks

---

## Monitoring Integration Examples

### Docker CLI
```bash
# Check health status
docker inspect user-feedback-web | jq '.[0].State.Health'

# Output
{
  "Status": "healthy",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2025-10-20T14:30:00.000000Z",
      "End": "2025-10-20T14:30:00.100000Z",
      "ExitCode": 0,
      "Output": ""
    }
  ]
}
```

### Kubernetes
```bash
# Check readiness
kubectl get pod user-feedback-web-xyz123 -o json | jq '.status.conditions'

# Describe pod with probe status
kubectl describe pod user-feedback-web-xyz123 | grep -A 5 "Liveness"
```

### Monitoring Dashboards (Grafana)
```
Dashboard: User Feedback Web Service
├─ Response Time (p50, p95, p99)
├─ Error Rate (4xx, 5xx %)
├─ WebSocket Connections (active)
├─ Memory Usage (RSS, Heap %)
├─ Database Status (connected/offline)
└─ Session Throughput (created/completed/rate)
```

---

## Testing Requirements
- [ ] Health endpoint responds 200 when ready
- [ ] Health endpoint responds 503 when degraded
- [ ] Response time < 100ms
- [ ] Memory metrics accurate
- [ ] Logs properly structured (JSON format)
- [ ] No secrets in logs (masking verified)
- [ ] Metrics endpoint accurate
- [ ] Kubernetes probe compatibility tested
