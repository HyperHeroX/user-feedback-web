# Spec: npm Distribution Optimization

**Capability:** Optimize npm package distribution to include only production files (dist/ + minimal documentation)

**Status:** PROPOSED  
**Applies to:** npm package publishing pipeline  
**Related changes:** None (first optimization pass for npm distribution)

---

## Overview

This spec defines requirements for optimizing the `user-web-feedback` npm package to exclude source code, build tools, development files, and non-essential documentation. The goal is to reduce package size by 60-80% while maintaining all production functionality.

---

## MODIFIED Requirements

### Requirement: Minimal npm Distribution

**Scope:** Define what files must be included in the npm package

#### Scenario: Consumer installs package from npm

```
Given: User runs npm install user-web-feedback
When: Installation completes
Then:
  - User's node_modules/user-web-feedback/ contains only:
    * dist/ with compiled JavaScript and TypeScript declarations
    * package.json
    * README.md
    * LICENSE
  - User's node_modules/user-web-feedback/ DOES NOT contain:
    * src/ (TypeScript source files)
    * tsconfig.json, jest.config.js, other build configs
    * scripts/, openspec/, .github/, data/ directories
    * Other non-essential documentation files
  - Disk usage: < 10 MB
```

#### Scenario: Consumer uses CLI tool from package

```
Given: Package is installed via npm install user-web-feedback
When: User runs npx user-web-feedback --help
Then:
  - Command executes successfully
  - No "file not found" errors
  - Help output displays correctly
```

#### Scenario: Consumer imports as library

```
Given: Package is installed via npm install user-web-feedback
When: Consumer runs:
    const feedback = require('user-web-feedback');
    // or
    import * as feedback from 'user-web-feedback';
Then:
  - Library imports without errors
  - All exported functions/classes are accessible
  - TypeScript types resolve correctly (for TypeScript projects)
```

---

### Requirement: package.json Configuration for npm Publishing

**Scope:** Define the npm publishing configuration

#### Current State (before optimization):
```json
{
  "name": "user-web-feedback",
  "version": "2.1.3",
  "main": "dist/index.js",
  "bin": {
    "user-web-feedback": "dist/cli.js"
  },
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
  ],
  "prepublishOnly": "npm run clean && npm run build"
}
```

#### MODIFIED Requirement:

The `package.json` `files` array MUST contain only:
- `"dist"` - Compiled JavaScript and TypeScript declarations
- `"README.md"` - Primary consumer documentation
- `"LICENSE"` - Licensing information

**Rationale:** These 3 items + auto-included `package.json` provide everything consumers need. Extended documentation should be referenced from GitHub, not bundled in package.

**Validation:**
```bash
npm pack
tar -tzf user-web-feedback-*.tgz | grep -v dist | grep -v README | grep -v LICENSE | grep -v package.json
# Output should be empty or only show metadata files (like package/LICENSE, not additional docs)
```

---

### Requirement: .npmignore Configuration

**Scope:** Define exclusion rules for npm publishing

#### Current State (partial):
- Already excludes src/, *.ts files
- Already excludes some build tools
- Missing: Explicit exclusions for data/, scripts/, openspec/, etc.

#### MODIFIED Requirement:

The `.npmignore` file MUST explicitly exclude:

**Development Directories:**
```
src/
scripts/
data/
openspec/
.github/
.cursor/
__tests__/
```

**Build/Configuration Files:**
```
tsconfig.json
jest.config.js
.eslintrc.json
.prettierrc
.editorconfig
Dockerfile
docker-compose.yml
```

**Development Documentation:**
```
DOCUMENTATION_INDEX.md
DEPLOYMENT_READY.md
IMPLEMENTATION_COMPLETE.md
QUICK_REFERENCE.md
ARCHITECTURE.md
API_DOCUMENTATION.md
SECURITY_CONSIDERATIONS.md
```

**Common Development Files:**
```
*.log
*.tmp
.DS_Store
Thumbs.db
.git
.gitignore
```

**Rationale:**
- `.npmignore` takes precedence over `files` field, serving as safety net
- Explicit exclusions prevent accidental inclusion of new development files
- Explains WHY each exclusion exists (for future maintainers)

**Validation:**
```bash
npm pack
tar -tzf user-web-feedback-*.tgz | grep -E "(src/|data/|scripts/|tsconfig|jest.config)" | wc -l
# Should output: 0
```

---

### Requirement: Build Process Preservation

**Scope:** Ensure build process remains unchanged and optimal

#### Current State:
- TypeScript compilation to dist/ works correctly
- Declaration files (*.d.ts) are generated
- `prepublishOnly` hook ensures clean build before publication
- Source maps generated

#### MODIFIED Requirement:

The `tsconfig.json` and build process MUST NOT be modified:

**Maintain in tsconfig.json:**
```json
{
  "declaration": true,
  "declarationMap": true,
  "sourceMap": true,
  "outDir": "./dist"
}
```

**Maintain in package.json:**
```json
"prepublishOnly": "npm run clean && npm run build",
"scripts": {
  "build": "tsc && node scripts/copy-static.cjs",
  "clean": "rm -rf dist"
}
```

**Rationale:**
- No changes needed to build pipeline
- Build process already optimal
- Declaration files ensure TypeScript consumers have proper types
- Source maps help with debugging

**Validation:**
```bash
npm run build
ls dist/*.d.ts | head -5  # Should show declaration files
```

---

### Requirement: Version Bump

**Scope:** Update package version for npm publication

#### MODIFIED Requirement:

When publishing this optimization to npm:
- Current version: 2.1.3
- New version: 2.1.4 (patch bump)
- Rationale: Optimization improves distribution only; no API/functionality changes

**Update process:**
```bash
npm version patch  # Automatically bumps to 2.1.4
git add package.json package-lock.json
git commit -m "chore: npm distribution optimization - reduce package size"
git tag v2.1.4
npm publish
```

**Validation:**
```bash
npm view user-web-feedback@2.1.4
# Should return package info for latest published version
```

---

### Requirement: Package Size Target

**Scope:** Define acceptable package size metrics

#### MODIFIED Requirement:

**Before optimization:**
- Estimated size: 80-150 MB (with node_modules and build artifacts)
- With npm pack: ~50-100 MB

**After optimization (target):**
- Package size (npm pack): < 10 MB (max 20 MB with contingency)
- Size reduction: 60-80%

**Validation:**
```bash
npm pack
ls -lh user-web-feedback-*.tgz
# Should show size < 10 MB
```

---

## Implementation Dependencies

These requirements depend on successful completion of:
1. ✅ Audit of current package contents (identify baseline)
2. ✅ Simplification of `files` array
3. ✅ Enhancement of `.npmignore`
4. ✅ Verification of declaration file generation
5. ✅ Testing with `npm pack`
6. ✅ Functional testing of CLI and library
7. ✅ Version bump and release notes

---

## Acceptance Criteria

✅ `npm pack` output contains:
- dist/ with compiled .js and .d.ts files
- package.json
- README.md
- LICENSE
- No source files (.ts from src/)
- No build tools (tsconfig.json, jest.config.js, etc.)
- No development directories (src/, data/, scripts/, etc.)

✅ Package size: < 10 MB (verified with `ls -lh`)

✅ CLI functionality: `npx user-web-feedback --version` works

✅ Library import: Consumer can import without errors

✅ TypeScript types: Declarations resolve correctly

✅ All tests pass: `npm test`

✅ Version updated to 2.1.4

✅ Release notes document the optimization

---

## Cross-references

- **Related spec:** None (first iteration)
- **Related change:** [Add SSE Integration](/openspec/changes/add-sse-integration) - May have similar packaging requirements in future
- **Related change:** [Enhance Remote Docker](/openspec/changes/enhance-remote-docker) - Containerized deployment may need similar optimizations

---

## Notes for Implementation

1. **Testing strategy:** Use `npm pack` as source of truth for what gets distributed
   ```bash
   npm pack --dry-run        # Preview without creating tarball
   npm pack                   # Create actual tarball
   tar -tzf *.tgz | sort     # List all files in package
   ```

2. **Common pitfalls to avoid:**
   - Forgetting that `node_modules/` is NEVER included in npm packages
   - Confusion between `.gitignore` and `.npmignore` (different purposes)
   - Not realizing that `package.json` and `package-lock.json` are auto-included
   - Assuming `files` field is the only filter (.npmignore overrides it)

3. **Future maintenance:**
   - If new runtime files are needed, must update both `files` array and test this spec
   - Periodically run `npm pack` to catch unexpected inclusions
   - Consider adding npm pack verification to CI/CD pipeline

4. **Rollback plan:**
   If issues arise after publication:
   - Publish hotfix (e.g., 2.1.5) with fixes
   - Document what went wrong in runbook
   - No need to unpublish 2.1.4 (npm allows republishing same version by requesting old package)
