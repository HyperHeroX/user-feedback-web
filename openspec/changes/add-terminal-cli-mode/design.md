# Design: Terminal CLI Mode for AI Responses

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Web Server                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  Settings API   │  │  AI Reply API   │  │  Terminals API      │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                      │             │
│           ▼                    ▼                      ▼             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    AI Service Layer                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │   │
│  │  │ API Mode    │  │  Mode Router │  │     CLI Mode        │ │   │
│  │  │ (existing)  │◄─┤              ├─►│     (new)           │ │   │
│  │  └─────────────┘  └──────────────┘  └─────────┬───────────┘ │   │
│  └───────────────────────────────────────────────┼─────────────┘   │
│                                                  │                  │
│  ┌───────────────────────────────────────────────▼─────────────┐   │
│  │                    CLI Service Layer (new)                   │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │   │
│  │  │  CLI Detector   │  │  CLI Executor   │  │  CLI Parser │  │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Database Layer                            │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────────┐  │   │
│  │  │  cli_settings │  │ cli_terminals │  │      logs       │  │   │
│  │  └───────────────┘  └───────────────┘  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. CLI Detector (`src/utils/cli-detector.ts`)

Responsible for detecting installed CLI tools on the system.

```typescript
// Types
interface CLIToolInfo {
  name: string;           // 'gemini' | 'claude' | 'codex'
  installed: boolean;
  version: string | null;
  path: string | null;
  command: string;        // Full command path
}

interface CLIDetectionResult {
  tools: CLIToolInfo[];
  timestamp: string;
}

// Main functions
async function detectCLITools(): Promise<CLIDetectionResult>;
async function checkToolInstalled(toolName: string): Promise<CLIToolInfo>;
async function getToolVersion(toolName: string): Promise<string | null>;
```

**Detection Strategy:**
- Use `which` (Unix) / `where` (Windows) to locate executables
- Execute `<tool> --version` to verify and get version
- Cache results with TTL to avoid repeated checks

### 2. CLI Executor (`src/utils/cli-executor.ts`)

Handles CLI command execution in non-interactive mode.

```typescript
// Types
interface CLIExecuteOptions {
  tool: 'gemini' | 'claude';
  prompt: string;
  timeout?: number;        // Default: 120000ms (2 minutes)
  workingDirectory?: string;
  outputFormat?: 'text' | 'json';
}

interface CLIExecuteResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;   // milliseconds
}

// Main functions
async function executeCLI(options: CLIExecuteOptions): Promise<CLIExecuteResult>;
function buildCommand(options: CLIExecuteOptions): string[];
function parseOutput(rawOutput: string, tool: string): string;
```

**Command Templates:**
```bash
# Gemini CLI
gemini -p "prompt" --output-format text

# Claude CLI
claude -p "prompt" --output-format text
```

### 3. CLI Settings Types (`src/types/index.ts` additions)

```typescript
// AI Mode selection
type AIMode = 'api' | 'cli';

// CLI Tool configuration
interface CLIToolConfig {
  name: string;
  enabled: boolean;
  command: string;
  args: string[];
  timeout: number;
}

// Extended AI Settings
interface AISettings {
  // ... existing fields
  aiMode: AIMode;                    // NEW: 'api' or 'cli'
  cliTool: string;                   // NEW: 'gemini' | 'claude'
  cliTimeout: number;                // NEW: timeout in ms
  cliFallbackToApi: boolean;         // NEW: fallback if CLI fails
}

// CLI Terminal tracking
interface CLITerminal {
  id: string;
  projectName: string;
  projectPath: string;
  tool: string;
  startedAt: string;
  lastActivityAt: string;
  status: 'running' | 'idle' | 'error' | 'stopped';
  pid?: number;
}

// CLI Execution Log
interface CLIExecutionLog {
  id: number;
  terminalId: string;
  prompt: string;
  response: string;
  executionTime: number;
  success: boolean;
  error?: string;
  createdAt: string;
}
```

### 4. Database Schema Changes

**New Table: cli_settings**
```sql
CREATE TABLE IF NOT EXISTS cli_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ai_mode TEXT DEFAULT 'api',          -- 'api' | 'cli'
  cli_tool TEXT DEFAULT 'gemini',      -- 'gemini' | 'claude'
  cli_timeout INTEGER DEFAULT 120000,  -- milliseconds
  cli_fallback_to_api INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**New Table: cli_terminals**
```sql
CREATE TABLE IF NOT EXISTS cli_terminals (
  id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  project_path TEXT NOT NULL,
  tool TEXT NOT NULL,
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'idle',
  pid INTEGER
);
```

**New Table: cli_execution_logs**
```sql
CREATE TABLE IF NOT EXISTS cli_execution_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  terminal_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  execution_time INTEGER,
  success INTEGER DEFAULT 1,
  error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES cli_terminals(id)
);
```

### 5. AI Service Integration

**Modified flow in `ai-service.ts`:**

```typescript
async function generateAIReply(request: AIReplyRequest): Promise<AIReplyResponse> {
  const settings = getAISettings();
  
  // Route based on AI mode
  if (settings.aiMode === 'cli') {
    return generateCLIReply(request, settings);
  }
  
  // Existing API flow
  return generateAPIReply(request, settings);
}

async function generateCLIReply(
  request: AIReplyRequest, 
  settings: AISettings
): Promise<AIReplyResponse> {
  try {
    const result = await executeCLI({
      tool: settings.cliTool as 'gemini' | 'claude',
      prompt: buildPrompt(request),
      timeout: settings.cliTimeout,
      workingDirectory: request.projectPath
    });
    
    if (result.success) {
      return { success: true, reply: result.output };
    }
    
    // Fallback to API if enabled
    if (settings.cliFallbackToApi) {
      logger.warn('CLI failed, falling back to API');
      return generateAPIReply(request, settings);
    }
    
    return { success: false, error: result.error };
  } catch (error) {
    // Log error and optionally fallback
    logCLIError(error);
    if (settings.cliFallbackToApi) {
      return generateAPIReply(request, settings);
    }
    throw error;
  }
}
```

### 6. Web API Endpoints

**New Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cli/detect` | Detect installed CLI tools |
| GET | `/api/cli/settings` | Get CLI settings |
| PUT | `/api/cli/settings` | Update CLI settings |
| GET | `/api/cli/terminals` | List CLI terminals |
| DELETE | `/api/cli/terminals/:id` | Stop and remove terminal |
| GET | `/api/cli/terminals/:id/logs` | Get execution logs for terminal |

### 7. Frontend Components

**Settings Page Updates (`settings.html`, `settings.js`):**
- Add "AI Mode" toggle (API / CLI)
- Dropdown for CLI tool selection
- Display detected CLI tools with status
- Timeout configuration
- Fallback option toggle

**New Terminal List Page (`terminals.html`, `terminals.js`):**
- Project card layout similar to dashboard
- Show: project name, path, CLI tool, status, last activity
- Actions: view logs, stop terminal
- Auto-refresh every 5 seconds

### 8. Error Handling Strategy

```typescript
enum CLIErrorCode {
  NOT_INSTALLED = 'CLI_NOT_INSTALLED',
  TIMEOUT = 'CLI_TIMEOUT',
  EXECUTION_FAILED = 'CLI_EXECUTION_FAILED',
  PARSE_ERROR = 'CLI_PARSE_ERROR',
  PERMISSION_DENIED = 'CLI_PERMISSION_DENIED'
}

class CLIError extends Error {
  constructor(
    public code: CLIErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'CLIError';
  }
}
```

### 9. Testing Strategy

**Unit Tests:**
- `cli-detector.test.ts` - Mock `child_process` for detection tests
- `cli-executor.test.ts` - Mock command execution, test parsing
- `cli-service.test.ts` - Integration with AI service

**Integration Tests:**
- Full flow: settings → CLI execution → response
- Fallback behavior when CLI fails
- Error logging verification

**E2E Tests:**
- Toggle CLI mode in settings UI
- Verify AI responses come from CLI
- Terminal list page functionality

## File Size Considerations

To maintain code quality and avoid large files:

| File | Max Lines | Responsibility |
|------|-----------|----------------|
| cli-detector.ts | 150 | Tool detection only |
| cli-executor.ts | 200 | Command execution only |
| cli-service.ts | 100 | Service orchestration |
| cli-settings.ts (DB) | 150 | Database operations |
| terminals.js (frontend) | 300 | UI logic |

## Security Considerations

1. **Command Injection Prevention**: Never interpolate user input directly into commands
2. **Timeout Enforcement**: Always set maximum execution time
3. **Working Directory Validation**: Verify paths before execution
4. **Output Sanitization**: Sanitize CLI output before displaying
