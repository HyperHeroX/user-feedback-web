# Design: npm Package Distribution Optimization

## Architecture Decision

### Strategy: Use npm's Native Publishing Mechanisms

**Approach:** Leverage `package.json` `files` field and `.npmignore` file as the primary distribution filters, with explicit, maintainable rules rather than implicit exclusions.

**Rationale:**
- npm's standard mechanisms are well-documented and widely understood
- `files` field + `.npmignore` combination allows fine-grained control
- No need to modify build pipeline or introduce complex tooling
- Easy to verify with `npm pack` command
- Future-proof: any new files must be explicitly allowed

### Design Principles

1. **Explicit is better than implicit**
   - Define exactly what gets published rather than excluding exceptions
   - Makes it obvious what a consumer receives
   - Easier for future maintainers to understand and modify

2. **Keep build process unchanged**
   - `prepublishOnly` script already performs clean build
   - TypeScript compilation to `dist/` already works correctly
   - Declaration file generation already enabled in `tsconfig.json`

3. **Minimize maintenance burden**
   - Use patterns and wildcards in `.npmignore` where possible
   - Document decisions in comments
   - Periodically audit with `npm pack`

## Technical Decisions

### `files` Array Strategy

**Decision:** Simplify to core production essentials.

**Current (11 items):**
```json
"files": [
  "dist",
  "README.md",
  "LICENSE",
  "DOCUMENTATION_INDEX.md",
  "DEPLOYMENT_READY.md",
  "IMPLEMENTATION_COMPLETE.md",
  "QUICK_REFERENCE.md",
  "ARCHITECTURE.md",
  "API_DOCUMENTATION.md",
  "SECURITY_CONSIDERATIONS.md",
  "RELEASE_NOTES.md"
]
```

**Proposed (4-5 items):**
- `dist/` - All compiled JavaScript and type declarations
- `package.json` - Package metadata (always included automatically)
- `README.md` - Primary documentation for consumers
- `LICENSE` - Licensing information (may be required by consumers)

**Alternative (more inclusive):**
- Also include `RELEASE_NOTES.md` if consumers find it valuable

**Rationale:**
- Consumer's primary need: production code (`dist/`) and how to use it (`README.md`)
- `LICENSE` and `package.json` are standard npm package components
- Multiple documentation files are for project contributors, not package consumers
- Reduces decision complexity: if docs are in multiple formats, choose single source of truth

### `.npmignore` Enhancement Strategy

**Decision:** Add comprehensive exclusions for all non-production directories.

**Additions needed:**
```
# Development directories
src/
scripts/
data/
openspec/
.github/
__tests__/
.cursor/

# Build/configuration files
tsconfig.json
jest.config.js
.eslintrc.json
.prettierrc
.editorconfig

# CI/CD and tooling
.github/
.gitignore

# Development documentation (if not already in files)
DOCUMENTATION_INDEX.md
DEPLOYMENT_READY.md
IMPLEMENTATION_COMPLETE.md
QUICK_REFERENCE.md
ARCHITECTURE.md
API_DOCUMENTATION.md
SECURITY_CONSIDERATIONS.md

# Common dev files
*.log
*.tmp
.DS_Store
Thumbs.db

# Docker files (not needed in npm package)
Dockerfile
docker-compose.yml
```

**Rationale:**
- `.npmignore` takes precedence over `files` field
- Serves as safety net: explicit exclusions prevent accidental inclusion
- Easy to verify: `npm pack` will show exactly what gets included

### Type Declarations Strategy

**Decision:** No changes needed - keep current settings.

**Current state (good):**
```json
"declaration": true,
"declarationMap": true,
"sourceMap": true
```

**Why it works:**
- TypeScript compiler already generates `*.d.ts` files in `dist/`
- Declaration maps allow consumers to navigate to source in their IDEs
- Source maps help with debugging
- All these are generated as part of build; they're not source files

### Version and Release Strategy

**Decision:** Bump patch version (x.x.Z) for this optimization.

**Rationale:**
- No breaking changes to functionality
- No API changes to library or CLI
- Package behavior is identical, only size differs
- Semver: patch version appropriate for internal/distribution improvements

## Trade-offs and Considerations

### Trade-off 1: Documentation Distribution

**Decision:** Don't include extensive docs in npm package.

**Pros:**
- Reduces package size significantly
- Consumers can read docs from GitHub/website
- Easier to update docs without npm re-publication
- Follows common practice (e.g., Express, Next.js distribute README only)

**Cons:**
- Offline users can't access extended documentation
- Some enterprise users might prefer complete offline docs

**Mitigation:** Keep GitHub repository as source of truth; npm package points to GitHub

### Trade-off 2: Explicit vs. Implicit Inclusion

**Decision:** Use explicit `files` array.

**Pros:**
- Forces intentional decision about each inclusion
- Clear to future maintainers what gets published
- Easier to audit

**Cons:**
- Slightly more verbose configuration
- Must remember to add new files to `files` array

**Mitigation:** Document this decision; periodically audit with `npm pack`

## Migration Path

1. **Prepare:** Review current npm package size and contents
2. **Modify:** Update `package.json` `files` field and `.npmignore`
3. **Verify:** Run `npm pack` and inspect tarball contents
4. **Test:** Verify CLI and library still work correctly
5. **Release:** Bump version, create PR, publish to npm with release notes explaining size reduction

## Verification Strategy

**Pre-publication verification:**
```bash
npm pack --dry-run          # See what would be packaged
tar -tzf user-web-feedback-*.tgz | sort  # Inspect exact contents
npm install ./user-web-feedback-*.tgz    # Test installation
npx user-web-feedback --version          # Verify CLI works
```

**Post-publication verification:**
- Install from npm: `npm install user-web-feedback`
- Verify CLI: `npx user-web-feedback --version`
- Verify library import: `require('user-web-feedback')`
- Check package contents: `npm pack user-web-feedback`

## Future Considerations

- If project adds runtime-necessary files (e.g., templates, assets), must update `files` field
- Periodically audit with `npm pack` to catch unexpected inclusions
- Consider using `bundledDependencies` if needed in future
