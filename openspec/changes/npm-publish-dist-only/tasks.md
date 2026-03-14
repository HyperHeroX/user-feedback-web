# Tasks: npm Package Distribution Optimization

## Overview
This task list implements the npm distribution optimization proposal, reducing package size from ~100MB to ~5-10MB by excluding source and development files.

**Estimated total effort:** 2-3 hours  
**Dependencies:** None (independent work)  
**Parallelizable:** Tasks 1-2 can run in parallel; 3+ sequential

---

## Task 1: Audit Current Package Contents
**Status:** Ready  
**Owner:** Code review  
**Effort:** 30 minutes

**Description:**
Examine current npm package contents and measure size baseline.

**Steps:**
1. Run `npm pack --dry-run` to see what would be packaged
2. Extract and list all files: `tar -tzf user-web-feedback-*.tgz | sort`
3. Measure package size: `ls -lh user-web-feedback-*.tgz`
4. Identify unnecessary files in current distribution
5. Document baseline metrics

**Validation:**
- [ ] Know baseline package size
- [ ] Identify all unnecessary files currently included
- [ ] Know approximate target size reduction percentage

**Output:** Baseline audit report (can be brief notes)

---

## Task 2: Review and Update package.json `files` Field
**Status:** Ready  
**Owner:** Configuration  
**Effort:** 20 minutes

**Description:**
Simplify the `files` array to include only essential distribution components.

**Current state (11 items):**
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

**Steps:**
1. Determine if all 8 documentation files are necessary for npm consumers
   - Consult design.md decision: prioritize README.md + point to GitHub for detailed docs
   - Consider: Are any of these referenced by consumers in `package.json` or as runtime dependencies?
2. Create new `files` array (proposed):
   ```json
   "files": [
     "dist",
     "README.md",
     "LICENSE"
   ]
   ```
3. Test decision: Run `npm pack` and verify new contents

**Alternative considerations:**
- Keep `RELEASE_NOTES.md` if end users find it valuable (decision to be made)
- Confirm none of the excluded docs are referenced in any build or runtime process

**Validation:**
- [ ] `package.json` updated with simplified `files` array
- [ ] npm pack shows only dist/, README.md, LICENSE (+ package.json, package-lock.json auto-added)
- [ ] No compilation or build errors

---

## Task 3: Enhance .npmignore with Comprehensive Exclusions
**Status:** Blocked on Task 1 (need baseline understanding)  
**Owner:** Configuration  
**Effort:** 20 minutes

**Description:**
Add explicit exclusions to `.npmignore` for all non-production directories and files.

**Current `.npmignore` coverage:**
- Already excludes `src/`, `*.ts` files (except dist/**/*.d.ts)
- Already excludes build tools and development docs

**Steps:**
1. Review current `.npmignore` content (59 lines)
2. Add explicit exclusions for:
   - `data/` directory
   - `scripts/` directory (or already excluded?)
   - `openspec/` directory
   - `.github/` directory
   - `.cursor/` directory (IDE config)
   - `__tests__/` directory (if exists at root)
   - All build/config files not already excluded
3. Verify each exclusion with comments explaining why
4. Run `npm pack` and inspect: `tar -tzf user-web-feedback-*.tgz | grep -E "(src/|data/|scripts/)" | wc -l` (should be 0)

**Validation:**
- [ ] `.npmignore` updated with comprehensive exclusions
- [ ] `npm pack` contains no files from: src/, data/, scripts/, openspec/, .github/, .cursor/
- [ ] No *.ts files in package (except dist/**/*.d.ts)
- [ ] No build config files in package (tsconfig.json, jest.config.js, etc.)

**Notes:**
- Use wildcards and patterns to avoid listing every file individually
- Add comments for future maintainers explaining exclusion rationale
- Test specific patterns if unsure: `npm pack` is the source of truth

---

## Task 4: Verify TypeScript Declaration Files are Included
**Status:** Ready  
**Owner:** Build verification  
**Effort:** 15 minutes

**Description:**
Confirm that TypeScript declaration files (*.d.ts) are properly generated and included in package.

**Current state:**
- `tsconfig.json` has `"declaration": true` and `"declarationMap": true`
- These should automatically generate .d.ts files in dist/

**Steps:**
1. Run `npm run build` to regenerate dist/ with declarations
2. Verify dist/ contains .d.ts files: `find dist -name "*.d.ts" | head -10`
3. Verify package.json has correct export:
   ```json
   "exports": {
     "types": "./dist/index.d.ts"
   }
   ```
   (or equivalent TypeScript export declaration)
4. Test with `npm pack`: Verify .d.ts files are in tarball

**Validation:**
- [ ] dist/ contains .d.ts files (e.g., dist/index.d.ts, dist/cli.d.ts)
- [ ] TypeScript consumer can resolve types correctly
- [ ] npm pack includes all .d.ts files under dist/
- [ ] No TypeScript errors in build output

**Notes:**
- This likely already works; mainly verification task
- If not, check `tsconfig.json` declaration settings

---

## Task 5: Test npm pack and Verify Package Contents
**Status:** Depends on Tasks 2, 3, 4  
**Owner:** Testing  
**Effort:** 20 minutes

**Description:**
Comprehensive test to verify package contains exactly what is intended and excludes what should be excluded.

**Steps:**
1. Clean and rebuild: `npm run clean && npm run build`
2. Create package: `npm pack --dry-run` (or save actual: `npm pack`)
3. List all files: `tar -tzf user-web-feedback-*.tgz | sort > package-contents.txt`
4. Verify expectations:
   - [ ] Contains `dist/` directory with .js and .d.ts files
   - [ ] Contains `package.json` and `README.md`
   - [ ] Contains `LICENSE`
   - [ ] Does NOT contain any `.ts` source files
   - [ ] Does NOT contain `src/`, `scripts/`, `data/`, `openspec/`, `.github/`, `tsconfig.json`, `jest.config.js`
   - [ ] Total file count reasonable (estimate: 50-200 files vs. 1000+ before)
5. Optional: Untar and inspect: `tar -xzf user-web-feedback-*.tgz && ls -la package/`
6. Measure new package size: `ls -lh user-web-feedback-*.tgz` (target: < 10MB)

**Validation:**
- [ ] npm pack succeeds without errors
- [ ] Package size reduced by 60-80% from baseline
- [ ] All .ts source files excluded
- [ ] All build/dev files excluded
- [ ] All production code and types included
- [ ] File structure looks reasonable

**Success criteria:**
- Package size: 5-10 MB (down from ~100 MB)
- Contains exactly what's needed for end users
- Ready for npm publish

---

## Task 6: Test CLI and Library Functionality After Packaging
**Status:** Depends on Task 5  
**Owner:** Functional testing  
**Effort:** 20 minutes

**Description:**
Verify that CLI and library functionality work correctly with the optimized package.

**Steps:**
1. Install from local package: `npm install ./user-web-feedback-*.tgz` (in a temp directory)
2. Verify CLI works: `npx user-web-feedback --version` or `npx user-web-feedback --help`
3. Verify library import works:
   ```javascript
   const feedback = require('user-web-feedback');
   // or for ESM
   import * as feedback from 'user-web-feedback';
   ```
4. Verify TypeScript types are accessible (if TypeScript project)
5. Run basic integration: Can you start the server? Can you make requests?
6. Verify no "file not found" errors for runtime assets

**Validation:**
- [ ] CLI commands execute successfully
- [ ] Library imports without errors
- [ ] TypeScript declarations can be resolved
- [ ] No missing file/module errors
- [ ] Server starts and responds to requests

**Notes:**
- This ensures no runtime dependencies are excluded
- If test fails, check .npmignore and files array for what was incorrectly excluded

---

## Task 7: Bump Version and Prepare Release
**Status:** Depends on Task 6  
**Owner:** Version management  
**Effort:** 15 minutes

**Description:**
Update package version and prepare release notes documenting the optimization.

**Steps:**
1. Current version: 2.1.3 (from package.json)
2. Bump to: 2.1.4 (patch version - internal optimization, no API changes)
   - Run: `npm version patch` (or manually edit version)
3. Update or create `RELEASE_NOTES.md` with entry:
   ```
   ## v2.1.4 - npm Distribution Optimization
   - Optimized npm package to include only production files
   - Reduced package size by ~80% (from ~100MB to ~10MB)
   - Removed source code, build tools, and development documentation from distribution
   - No changes to API or functionality
   - All consumer-facing features unchanged
   ```
4. Stage changes: `git add package.json RELEASE_NOTES.md`

**Validation:**
- [ ] Version bumped in package.json
- [ ] RELEASE_NOTES.md updated with clear summary
- [ ] No TypeScript/build errors after version bump
- [ ] Ready for git commit and PR

---

## Task 8: Final Validation and Documentation
**Status:** Depends on Task 7  
**Owner:** Documentation  
**Effort:** 15 minutes

**Description:**
Final checks before publishing, document decisions for future reference.

**Steps:**
1. Run full test suite: `npm test` (ensure nothing broke)
2. Run linting: `npm run lint` (if applicable)
3. Create summary document noting:
   - Baseline size vs. optimized size
   - Which files/directories were excluded and why
   - Any trade-offs made
   - Future maintenance considerations
4. Add comment to package.json explaining files array (optional but helpful)

**Validation:**
- [ ] All tests pass
- [ ] No lint errors
- [ ] Documentation complete and accurate
- [ ] Ready for PR review and npm publication

**Notes:**
- This is the final gate before publication
- Ensure all previous tasks are fully complete

---

## Task Sequencing

**Phase 1 - Discovery (Parallel possible):**
- Task 1: Audit current package
- Task 2: Update package.json files field

**Phase 2 - Implementation (Sequential):**
- Task 3: Enhance .npmignore
- Task 4: Verify declaration files

**Phase 3 - Validation (Sequential):**
- Task 5: Test npm pack contents
- Task 6: Test functionality

**Phase 4 - Release (Sequential):**
- Task 7: Bump version
- Task 8: Final validation

## Definition of Done

When all 8 tasks are completed and passing:
- ✅ npm package optimized to dist-only distribution
- ✅ Package size reduced by 60-80%
- ✅ All tests passing
- ✅ Functionality verified
- ✅ Version bumped and release notes prepared
- ✅ Ready for PR and npm publication
