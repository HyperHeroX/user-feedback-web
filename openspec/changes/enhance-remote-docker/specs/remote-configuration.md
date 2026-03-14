# Specification: Remote Server Configuration

**Capability ID:** `remote-configuration`  
**Component:** `config/index.ts`, `server/web-server.ts`  
**MCP Version:** 1.12.1+  
**Status:** New

## Purpose
Enable flexible remote deployment by allowing administrators to configure server host, port, and external URL independently, supporting both local and distributed environments.

## ADDED Requirements

### Requirement: Server Host Configuration
**ID:** `remote-config-host`

Administrators MUST be able to specify the network interface on which the web server listens.

#### Scenario: Local Development
```typescript
// Default: localhost (127.0.0.1)
MCP_SERVER_HOST not set
→ Server listens on 127.0.0.1:5050 (local only)
→ URL: http://localhost:5050
```

#### Scenario: Docker Container
```typescript
// All interfaces
MCP_SERVER_HOST=0.0.0.0
→ Server listens on 0.0.0.0:5050 (accessible from network)
→ URL: http://<container-ip>:5050
```

#### Scenario: Specific Interface
```typescript
// Named interface
MCP_SERVER_HOST=192.168.1.100
→ Server listens only on 192.168.1.100:5050
→ URL: http://192.168.1.100:5050
```

**Acceptance Criteria:**
- [ ] Config accepts `MCP_SERVER_HOST` environment variable
- [ ] Default value is `'localhost'` for security
- [ ] Server binds to specified host on startup
- [ ] Invalid hosts are rejected with validation error
- [ ] Host is logged on startup (unmasked)

---

### Requirement: External URL Override
**ID:** `remote-config-base-url`

Administrators MUST be able to override the auto-generated server URL for cases where Docker port mapping or reverse proxies change the external address.

#### Scenario: Behind Reverse Proxy
```typescript
// Reverse proxy: https://feedback.example.com → http://localhost:5050
MCP_SERVER_BASE_URL=https://feedback.example.com
→ Generated URL for sessions: https://feedback.example.com
→ Users access via: https://feedback.example.com/?mode=feedback&session=xxx
```

#### Scenario: Custom Port Mapping
```typescript
// Docker port mapping: 8080:5050
MCP_SERVER_HOST=0.0.0.0
MCP_WEB_PORT=5050
// Container doesn't know about port 8080
MCP_SERVER_BASE_URL=http://my.server.com:8080
→ Generated URL: http://my.server.com:8080
```

#### Scenario: Auto-Generated (Default)
```typescript
// No override set
MCP_SERVER_HOST=192.168.1.10
MCP_WEB_PORT=5050
→ Generated URL: http://192.168.1.10:5050
```

**Acceptance Criteria:**
- [ ] Config accepts `MCP_SERVER_BASE_URL` environment variable
- [ ] Valid URLs (http/https) are accepted
- [ ] Invalid URLs rejected with validation error
- [ ] Overrides auto-generated URL completely
- [ ] `generateFeedbackUrl()` uses override when set
- [ ] URL is logged on startup (unmasked)

---

### Requirement: HTTPS Support Flag
**ID:** `remote-config-https`

The system MUST be prepared for HTTPS deployment via environment configuration.

#### Scenario: HTTPS Behind Proxy
```typescript
MCP_USE_HTTPS=true
MCP_SERVER_HOST=0.0.0.0
→ Generated URL scheme: https://
→ Example: https://localhost:5050
```

#### Scenario: HTTP Default
```typescript
MCP_USE_HTTPS not set (default: false)
→ Generated URL scheme: http://
```

**Note:** Actual HTTPS termination typically handled by reverse proxy; this flag ensures correct URL generation.

**Acceptance Criteria:**
- [ ] Config accepts `MCP_USE_HTTPS` boolean environment variable
- [ ] Default is `false` (http)
- [ ] Affects `generateFeedbackUrl()` scheme selection
- [ ] Works with `MCP_SERVER_BASE_URL` override
- [ ] Logged on startup

---

### Requirement: Configuration Validation on Startup
**ID:** `remote-config-validation`

The system MUST validate all remote configuration on startup and fail fast with clear errors.

#### Scenario: Invalid Port
```typescript
MCP_WEB_PORT=99999  // Out of range
→ Validation fails
→ Error: "Invalid port number: 99999. Must be between 1024 and 65535."
→ Process exits with code 1
```

#### Scenario: Invalid URL
```typescript
MCP_SERVER_BASE_URL="not a valid url"
→ Validation fails
→ Error: "Invalid server base URL: not a valid url"
→ Process exits with code 1
```

#### Scenario: All Valid
```typescript
MCP_SERVER_HOST=0.0.0.0
MCP_WEB_PORT=5050
MCP_USE_HTTPS=false
MCP_SERVER_BASE_URL not set
→ Validation passes
→ Log: "Configuration validated successfully"
→ Server starts normally
```

**Acceptance Criteria:**
- [ ] All config validated before server starts
- [ ] Validation errors logged with clear messages
- [ ] Process exits with non-zero code on validation failure
- [ ] Validation includes: port range, URL format, boolean values
- [ ] Helpful error messages suggest corrections

---

## MODIFIED Requirements

### Requirement: Web Server Startup Logging
**ID:** `remote-config-logging`

**Current:** Server logs port only  
**Modified:** Server MUST log all remote configuration for transparency

#### Before (v2.1.3)
```
[INFO] Web服务器启动成功: http://localhost:5050
```

#### After (v3.0.0)
```
[INFO] Remote configuration:
  - Server Host: 0.0.0.0
  - Web Port: 5050
  - HTTPS: false
  - Base URL: http://localhost:5050
[INFO] Web服务器启动成功: http://localhost:5050
```

**Acceptance Criteria:**
- [ ] Startup logs include: host, port, https flag, generated URL
- [ ] Secrets (API keys) NOT logged
- [ ] Configuration logged BEFORE server starts listening
- [ ] Logged values match actual runtime behavior

---

## Environment Variable Reference

| Variable | Type | Default | Example | Required |
|----------|------|---------|---------|----------|
| `MCP_SERVER_HOST` | string | `localhost` | `0.0.0.0` | No |
| `MCP_WEB_PORT` | number | `5050` | `8080` | No |
| `MCP_USE_HTTPS` | boolean | `false` | `true` | No |
| `MCP_SERVER_BASE_URL` | URL | auto-generated | `https://feedback.example.com` | No |
| `NODE_ENV` | string | `production` | `development` | No |
| `LOG_LEVEL` | string | `info` | `debug` | No |

---

## Configuration Priority

1. **Explicit override**: `MCP_SERVER_BASE_URL` (if set, all URL generation uses this)
2. **Component values**: `MCP_SERVER_HOST`, `MCP_WEB_PORT`, `MCP_USE_HTTPS`
3. **Derived**: `http://${host}:${port}` (if override not set)
4. **Defaults**: `localhost:5050`, http

---

## Usage Examples

### Local Development
```bash
# Works out of box, no config needed
npm run start
# → Listens on localhost:5050
# → http://localhost:5050
```

### Docker (Internal Network)
```bash
# docker-compose.yml
environment:
  - MCP_SERVER_HOST=0.0.0.0
  - MCP_WEB_PORT=5050
# → Listens on all interfaces
# → Accessible from other services via http://user-feedback-web:5050
# → Accessible from host via http://localhost:5050
```

### Remote Deployment (HTTPS)
```bash
# Behind nginx reverse proxy (https://feedback.example.com → http://localhost:5050)
MCP_SERVER_HOST=0.0.0.0 \
MCP_WEB_PORT=5050 \
MCP_USE_HTTPS=true \
MCP_SERVER_BASE_URL=https://feedback.example.com \
npm run start
# → Listens on 0.0.0.0:5050 (internal)
# → Generated URL: https://feedback.example.com
# → Users access: https://feedback.example.com/?mode=feedback&session=xxx
```

---

## Related Capabilities
- `docker-deployment`: How remote config is used in container deployments
- `health-observability`: Health checks reference server configuration
- `graceful-shutdown`: Shutdown behavior independent of configuration

---

## Testing Requirements

- [ ] Unit test: Config validation (valid/invalid hosts, ports, URLs)
- [ ] Unit test: URL generation with all combinations (host, port, https, override)
- [ ] Integration test: Server binds to configured host
- [ ] Integration test: Feedback URL generated correctly in Docker
- [ ] Integration test: Reverse proxy scenario (base URL override)

---

## Security Implications

- Default `MCP_SERVER_HOST=localhost` prevents accidental external exposure
- Admins must explicitly set `0.0.0.0` for networked access
- URL override enables HTTPS behind proxies (forward security)
- No secrets in configuration (API keys separate via env vars)
