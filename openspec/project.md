# Project Context

## Purpose
**MCP Feedback Collector** (user-web-feedback) is a modern Node.js-based feedback collection system that supports AI work reporting and user feedback collection through the Model Context Protocol (MCP). The project provides a real-time web interface for users to submit feedback with text and images, which AI assistants can request and process.

**Key Goals:**
- Provide seamless integration with MCP-compatible AI clients (Claude Desktop, Cursor IDE)
- Enable real-time feedback collection through an intuitive web interface
- Support multimedia feedback (text + images) with AI-powered image-to-text conversion
- Deliver a stable, performant alternative to Python-based implementations

## Tech Stack
### Core Technologies
- **TypeScript 5.2+** - Primary language with strict type checking
- **Node.js 18+** - Runtime environment (ES2022 target)
- **Express.js 4.18** - Web server framework
- **Socket.IO 4.7** - Real-time bidirectional communication

### MCP Integration
- **@modelcontextprotocol/sdk 1.12+** - Official MCP protocol implementation
- Implements `collect_feedback` and `pick_image` tools

### Image Processing
- **Jimp 0.22** - Image manipulation and format conversion
- **AI Image-to-Text** - Optional conversion using configured AI API

### Additional Libraries
- **commander** - CLI argument parsing
- **dotenv** - Environment configuration
- **cors, helmet, compression** - Security and performance middleware
- **find-free-port** - Dynamic port allocation

### Development Tools
- **Jest + ts-jest** - Unit testing framework
- **ESLint + @typescript-eslint** - Code linting
- **tsx** - TypeScript execution and hot-reload in development

## Project Conventions

### Code Style
- **Module System**: ES Modules (`.js` imports, `type: "module"` in package.json)
- **Target**: ES2022 with bundler module resolution
- **Strict TypeScript**: All strict flags enabled (noImplicitAny, strictNullChecks, etc.)
- **File Extensions**: Always use `.js` extension in imports (TypeScript ESM requirement)
- **Naming Conventions**:
  - Files: kebab-case (e.g., `mcp-server.ts`, `port-manager.ts`)
  - Classes: PascalCase (e.g., `MCPServer`, `ImageProcessor`)
  - Functions/Variables: camelCase (e.g., `createSession`, `sessionId`)
  - Constants: UPPER_SNAKE_CASE (e.g., `VERSION`, `MCP_API_KEY`)
  - Environment Variables: MCP_ prefix (e.g., `MCP_WEB_PORT`, `MCP_ENABLE_CHAT`)

### Architecture Patterns
- **Modular Design**: Clear separation between CLI, MCP server, Web server, and utilities
- **Session Management**: Unique session IDs with timeout-based lifecycle
- **Port Management**: Automatic port detection, conflict resolution, and cleanup
- **Error Handling**: Comprehensive try-catch with detailed logging
- **Configuration**: Environment-first with sensible defaults (`.env` + `config/`)
- **Graceful Shutdown**: Process signal handling and resource cleanup

**Directory Structure:**
```
src/
├── cli.ts                 # Entry point, CLI interface
├── index.ts               # Public API exports
├── config/                # Configuration management
├── server/
│   ├── mcp-server.ts      # MCP protocol implementation
│   └── web-server.ts      # HTTP/WebSocket server
├── static/                # Web UI assets
├── types/                 # TypeScript type definitions
└── utils/                 # Shared utilities
```

### Testing Strategy
- **Framework**: Jest with ts-jest for TypeScript support
- **Test Files**: Co-located in `src/__tests__/` directory
- **Coverage**: Unit tests for core utilities and integration tests for workflows
- **Test Types**:
  - `basic.test.ts` - Core functionality
  - `config.test.ts` - Configuration validation
  - `image-processor.test.ts` - Image manipulation
  - `integration.test.ts` - End-to-end scenarios
  - `port-manager.test.ts` - Port allocation logic
- **Commands**:
  - `npm test` - Run all tests
  - `npm run test:watch` - Watch mode for development

### Git Workflow
- **Main Branch**: `main` (default and current branch)
- **Repository**: https://github.com/HyperHeroX/user-feedback-web
- **Versioning**: Semantic versioning (currently v2.1.3)
- **Release Process**: 
  - Update version in `package.json`
  - Run `npm run prepare-release` (automated changelog and notes)
  - Build and publish to npm
  - Tag release on GitHub

**Commit Conventions**: Not strictly enforced, but prefer descriptive messages

## Domain Context
### MCP (Model Context Protocol)
- **Protocol**: Standard for AI-tool integration developed by Anthropic
- **Tools**: Exposed via MCP server (`collect_feedback`, `pick_image`, `get_image_info`)
- **Clients**: Claude Desktop, Cursor IDE, and other MCP-compatible applications
- **Communication**: Stdio transport for MCP messages, separate Web/WebSocket for UI

### Feedback Collection Workflow
1. AI calls `collect_feedback` tool with message and optional timeout
2. MCP server creates unique session and launches web interface
3. User submits feedback (text + images) through browser
4. WebSocket transmits data back to MCP server in real-time
5. AI receives feedback and continues conversation
6. Session auto-expires after timeout or explicit completion

### Image Handling
- **Formats**: JPEG, PNG, GIF, WebP (browser clipboard support)
- **Processing**: Base64 encoding, resize, format conversion via Jimp
- **Image-to-Text**: Optional AI-powered description for compatibility
- **Storage**: Temporary in-memory storage, no persistence by default

## Important Constraints
### Technical
- **Node.js Version**: Minimum 18.0.0 (uses modern ES2022 features)
- **Port Conflicts**: Must handle port allocation gracefully (configurable strategies)
- **Session Timeout**: Range 10-60000 seconds (enforced validation)
- **Cross-Platform**: Must work on Windows, macOS, Linux (tested on all three)

### Performance
- **Startup Time**: Must launch web server quickly for responsive UX
- **Memory**: Efficient session cleanup to avoid leaks
- **Browser Compatibility**: Modern browsers (Chrome, Firefox, Edge, Safari)

### Security
- **CORS**: Configurable origin restrictions
- **Helmet**: HTTP security headers enabled
- **Input Validation**: Sanitize user-provided feedback and image data
- **Port Access**: Configurable kill behavior for occupied ports

### Business
- **NPM Distribution**: Primary delivery via `npx user-web-feedback`
- **Zero-Config**: Works out-of-box without mandatory configuration
- **Documentation**: Extensive guides (USER_GUIDE, CONFIGURATION, TROUBLESHOOTING)

## External Dependencies
### Required Services
- **AI API** (Optional for image-to-text):
  - Configurable via `MCP_API_BASE_URL` (default: https://api.ssopen.top)
  - Supports OpenAI-compatible endpoints
  - Requires `MCP_API_KEY` for authenticated requests
  - Default model: `grok-3` (configurable via `MCP_DEFAULT_MODEL`)

### Browser Requirements
- Modern browser with WebSocket support
- Clipboard API for image paste functionality
- LocalStorage for session data persistence

### System Dependencies
- No external binaries required (pure Node.js)
- Port availability: Default 5000 or auto-allocated alternative
