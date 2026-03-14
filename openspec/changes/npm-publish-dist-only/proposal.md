# Proposal: Optimize npm Package Distribution (dist-only)

## Problem Statement

The `user-web-feedback` npm package currently includes source files, build tools, scripts, and configuration files that are unnecessary for end users. This increases package size, exposes internal project structure, and creates potential security/maintenance concerns. The current `package.json` `files` array includes 11 items, many of which are developer-facing documentation and tooling files.

**Current unnecessary inclusions:**
- `src/` directory (via lack of proper exclusion)
- Build configuration files (`tsconfig.json`, `jest.config.js`, `.eslintrc.json`)
- Development scripts (`scripts/` directory)
- Multiple development/project documentation files
- Data and configuration directories (`data/`, etc.)

## Goals

1. **Reduce package size** by excluding all unnecessary files from npm distribution
2. **Improve maintainability** by using explicit npm publishing configuration
3. **Enhance security** by not exposing project structure, build tools, or internal scripts
4. **Maintain functionality** by preserving all production code and necessary type definitions

## Current State

**What works today:**
- Compilation to `dist/` with TypeScript declarations enabled
- `.npmignore` already excludes `src/` and some build tools
- `package.json` `files` array specifies intentional distribution list
- `prepublishOnly` script ensures clean build before publication
- Main entry point: `dist/index.js`, CLI entry: `dist/cli.js`

**What needs improvement:**
- `files` array includes 8 documentation files (some may be unnecessary)
- `.npmignore` doesn't explicitly exclude all non-essential directories
- No mechanism to exclude `data/`, `scripts/`, or other runtime directories
- Unclear whether all 8 documentation files are essential for npm consumers

## Proposed Solution

1. **Audit the current `files` array** and remove unnecessary documentation
   - Keep: `dist/`, `package.json`, `README.md`, `LICENSE`
   - Evaluate: Other documentation files for necessity in npm consumers

2. **Enhance `.npmignore`** to explicitly exclude development-only content
   - Exclude: `src/`, `scripts/`, `data/`, `openspec/`, `.github/`, etc.
   - Exclude: All build/config files except those needed at runtime

3. **Verify npm pack output** contains only necessary files

4. **Test the distribution** to ensure CLI and library functionality remain intact

## Benefits

- **Package size reduction** (~60-80% estimated based on typical source-to-build ratio)
- **Faster installations** for end users
- **Cleaner distribution** with only production-relevant code
- **Security improvement** by not exposing internal project structure
- **Better maintainability** through explicit publishing rules

## Success Criteria

✅ `npm pack` output contains only:
  - `dist/` directory (JS + type declaration files)
  - `package.json`
  - `README.md`
  - `LICENSE`
  - `package-lock.json` (generated at publish time)

✅ All tests pass

✅ CLI functionality (`npx user-web-feedback`) works correctly

✅ Library import functionality works correctly for consumers

✅ Type declarations are properly accessible

## Implementation Approach

This change will be implemented through:
1. Modification of `package.json` `files` field
2. Enhancement of `.npmignore` with comprehensive exclusions
3. Testing with `npm pack` to verify output
4. Version bump and release process
