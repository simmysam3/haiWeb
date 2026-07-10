# Default-Deny Allowlist for the Agent Archive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch the distributed agent archive from denylist (`git archive HEAD` minus export-ignores) to a default-deny allowlist, so internal-but-unnamed files (CLAUDE.md, kill scripts, deploy-agent.sh, internal docs/scripts) never ship, and ship only the protocol conformance kit for tests.

**Architecture:** `buildAgentZip` gains an `allowlist` parameter (defaulting to a maintained constant) that becomes the `git archive HEAD -- <allowlist>` pathspec. Demo-data `export-ignore` rules stay as defense-in-depth inside shipped dirs; tests are excluded except the conformance kit via broad `export-ignore` + a more-specific un-ignore. The existing fail-closed denylist guard is unchanged and backstops over-inclusion; a new lightweight invariant test backstops under-inclusion.

**Tech Stack:** Node ESM (`.mjs`), Vitest (node env), `git archive` pathspec, `.gitattributes`.

## Global Constraints

- Spec: `haiWeb/docs/superpowers/specs/2026-07-10-agent-archive-allowlist-design.md`.
- Builds on the OPEN, unmerged branches — land on them, do NOT create new branches:
  - haiWeb `chore/agent-archive-guard` (PR #132)
  - haiClient `chore/strip-demo-fingerprint` (PR #85)
- Explicit `git add <paths>`, never `-A`. No pushes without Sam. Leave untracked EG4/env files alone.
- The archive allowlist (ship set), exact paths:
  `src`, `packages`, `haicore-protocol`, `frontend`, `public`, `config`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.typecheck.json`, `vitest.config.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `scripts/docker-entrypoint.sh`, `scripts/seed-config.mjs`, `scripts/hash-chat-password.mjs`, `README.md`, `UPGRADING.md`, `CHANGELOG.md`, `LICENSE`, `.env.example`, `.gitignore`.
- Excluded by default (must NOT appear in the archive): `CLAUDE.md`, `.gitattributes`, `kill-agents.ps1`, `kill-all.ps1`, `deploy-agent.sh`, `docs/`, all other `scripts/*`, `seed-data/`, `test-environment/`, `e2e/`, `seed-products.mjs`.
- Tests: ship ONLY `packages/client-sdk/src/__tests__/conformance/`; exclude every other test.
- TDD red→green for behavior (Tasks 1, 2). Config edits (Task 3, 4) verify by `git archive`/inspection.

---

### Task 1: Allowlist constant + parameterize `buildAgentZip` (haiWeb)

**Files:**
- Create: `haiWeb/scripts/lib/agent-archive-allowlist.mjs`
- Modify: `haiWeb/scripts/build-agent-zip.mjs`
- Modify: `haiWeb/scripts/__tests__/build-agent-zip.test.ts` (update existing calls)

**Interfaces:**
- Produces: `ALLOWLIST: string[]` (exported). `buildAgentZip` gains an `allowlist` option (defaults to `ALLOWLIST`); it becomes the `git archive` pathspec.
- Consumes: existing `scanZipForDenylist` / `DENYLIST` (unchanged).

- [ ] **Step 1: Write the allowlist module**

Create `haiWeb/scripts/lib/agent-archive-allowlist.mjs`:

```js
/**
 * Default-deny allowlist for the distributed agent archive. Only these paths
 * are shipped (via `git archive HEAD -- <allowlist>`); everything else — internal
 * docs, ops scripts, CLAUDE.md, kill scripts, deploy-agent.sh, demo data — is
 * excluded by default. Determined by what the build (tsc), the Docker image, and
 * the runtime entrypoint actually need, plus adopter-facing meta. Keep in sync
 * with the spec 2026-07-10-agent-archive-allowlist-design.md. Adding an
 * adopter-facing file? Enroll it here or it will not ship (the invariant test
 * guards known-required entries).
 *
 * Fail-loud: `git archive HEAD -- <paths>` exits non-zero if ANY listed path
 * matches nothing. So renaming/removing an allowlisted file (e.g. UPGRADING.md,
 * vitest.config.ts) hard-fails the archive build with a raw git error — the safe
 * direction (loud, never silent under-inclusion). Update this list when you
 * rename or remove an entry.
 */
export const ALLOWLIST = [
  // code & build inputs
  'src', 'packages', 'haicore-protocol', 'frontend', 'public', 'config',
  // manifests & build config
  'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.typecheck.json', 'vitest.config.ts',
  // container build + runtime (Dockerfile COPYs these three scripts; entrypoint runs seed-config, which imports hash-chat-password)
  'Dockerfile', 'docker-compose.yml', '.dockerignore',
  'scripts/docker-entrypoint.sh', 'scripts/seed-config.mjs', 'scripts/hash-chat-password.mjs',
  // adopter docs & meta
  'README.md', 'UPGRADING.md', 'CHANGELOG.md', 'LICENSE', '.env.example', '.gitignore',
];
```

- [ ] **Step 2: Update existing tests to pass `allowlist: ['.']` (keep them green)**

The existing tests build synthetic repos whose files (`index.ts`, planted `leak.ts`, `amphenol-config.json`) are not in the real allowlist. They test the guard/manifest, not the allowlist, so they should archive everything. In `haiWeb/scripts/__tests__/build-agent-zip.test.ts`, add `allowlist: ['.']` to EVERY existing `buildAgentZip({ ... })` call (the archive/manifest test, the two throw-on-leak tests, the clean-repo test, the leaked-zip-deletion test, the filename-fingerprint test). Example:

```ts
const manifest = buildAgentZip({ repoPath: repo, outDir: out, now: new Date('2026-06-08T00:00:00Z'), allowlist: ['.'] });
```
(The `throws on a non-git path` and `no version` cases fail before archiving, so `allowlist` is optional there — adding it is harmless.)

- [ ] **Step 3: Run existing tests to confirm they still pass (before changing the impl they pass trivially since the param is ignored)**

Run: `cd haiWeb && npx vitest run scripts/__tests__/build-agent-zip.test.ts`
Expected: all pass (the param is not yet consumed).

- [ ] **Step 4: Parameterize `buildAgentZip`**

In `haiWeb/scripts/build-agent-zip.mjs`:

Add the import near the top (after the denylist import):
```js
import { ALLOWLIST } from './lib/agent-archive-allowlist.mjs';
```

Change the signature and the `git archive` call. Replace:
```js
export function buildAgentZip({ repoPath, outDir, now = new Date() }) {
```
with:
```js
export function buildAgentZip({ repoPath, outDir, now = new Date(), allowlist = ALLOWLIST }) {
```

Replace the archive line:
```js
  execFileSync('git', ['-C', repo, 'archive', '--format=zip', '-o', zipPath, 'HEAD'], { stdio: 'pipe' });
```
with:
```js
  execFileSync('git', ['-C', repo, 'archive', '--format=zip', '-o', zipPath, 'HEAD', '--', ...allowlist], { stdio: 'pipe' });
```

Update the CLI entrypoint's default is automatic (it calls `buildAgentZip({ repoPath, outDir })`, which now uses `ALLOWLIST`).

- [ ] **Step 5: Run existing tests again — confirm still green with the pathspec applied**

Run: `cd haiWeb && npx vitest run scripts/__tests__/build-agent-zip.test.ts`
Expected: all pass. (`allowlist: ['.']` makes `git archive HEAD -- .` = archive everything, so guard/manifest behavior is unchanged for the synthetic repos.)

- [ ] **Step 6: Commit (haiWeb)**

```bash
cd haiWeb
git add scripts/lib/agent-archive-allowlist.mjs scripts/build-agent-zip.mjs scripts/__tests__/build-agent-zip.test.ts
git commit -m "feat(agent-archive): default-deny allowlist pathspec for the archive"
```
End the message body with:
```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

### Task 2: Under-inclusion invariant test (haiWeb)

**Files:**
- Modify: `haiWeb/scripts/__tests__/build-agent-zip.test.ts`

**Interfaces:**
- Consumes: `buildAgentZip`, `ALLOWLIST` (default). Produces: a hermetic test that a real allowlist ships required entries and excludes internal ones.

- [ ] **Step 1: Write the failing invariant test**

Add to `haiWeb/scripts/__tests__/build-agent-zip.test.ts`. It builds a synthetic repo that mirrors the allowlist decision (some allowlisted paths, some internal paths, a conformance file, a non-conformance test) and asserts the DEFAULT allowlist ships the right set. Reuse the existing `tmp`/`created` helpers.

```ts
import { ALLOWLIST } from '../lib/agent-archive-allowlist.mjs';

function initStructuredRepo(): string {
  const dir = tmp('agentzip-struct-');
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@t.t');
  git('config', 'user.name', 'T');
  const write = (rel: string, content: string) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  };
  // package.json needs a version for buildAgentZip
  write('package.json', JSON.stringify({ name: 'agent', version: '9.9.9' }));
  // allowlisted paths (should ship)
  write('src/index.ts', 'export const x = 1;\n');
  write('packages/client-sdk/src/__tests__/conformance/jwt-auth.test.ts', '// conformance\n');
  write('haicore-protocol/dist/index.js', 'exports.x = 1;\n');
  write('Dockerfile', 'FROM node:22\n');
  write('scripts/docker-entrypoint.sh', '#!/bin/sh\n');
  write('scripts/seed-config.mjs', '// seed\n');
  write('scripts/hash-chat-password.mjs', '// hash\n');
  // internal paths (should NOT ship)
  write('CLAUDE.md', '# internal\n');
  write('.gitattributes', 'src/ text\n');
  write('kill-agents.ps1', '# kill\n');
  write('deploy-agent.sh', '#!/bin/sh\n');
  write('docs/typed-memory.md', '# doc\n');
  write('scripts/sync-protocol.mjs', '// internal\n');
  write('src/chat/__tests__/query-router.test.ts', '// non-conformance test\n');
  git('add', '-A');
  git('commit', '-qm', 'init');
  return dir;
}

describe('agent archive allowlist invariants', () => {
  it('ships required entries and excludes internal ones under the default allowlist', () => {
    const repo = initStructuredRepo();
    const out = tmp('agentzip-out-');
    const manifest = buildAgentZip({ repoPath: repo, outDir: out }); // default ALLOWLIST
    const entries = execFileSync('unzip', ['-Z1', join(out, manifest.zipFile)]).toString();

    // present (required)
    for (const p of [
      'src/index.ts',
      'packages/client-sdk/src/__tests__/conformance/jwt-auth.test.ts',
      'haicore-protocol/dist/index.js',
      'Dockerfile',
      'scripts/docker-entrypoint.sh',
      'scripts/seed-config.mjs',
      'scripts/hash-chat-password.mjs',
      'package.json',
    ]) {
      expect(entries, `expected ${p} to ship`).toContain(p);
    }

    // absent (internal / non-conformance)
    for (const p of [
      'CLAUDE.md',
      '.gitattributes',
      'kill-agents.ps1',
      'deploy-agent.sh',
      'docs/typed-memory.md',
      'scripts/sync-protocol.mjs',
      'src/chat/__tests__/query-router.test.ts',
    ]) {
      expect(entries.split('\n'), `expected ${p} to be excluded`).not.toContain(p);
    }
  });

  it('the allowlist has no obviously-internal entries', () => {
    for (const p of ALLOWLIST) {
      expect(p).not.toMatch(/^(CLAUDE\.md|deploy-agent\.sh|kill-|docs\/|\.gitattributes)/);
    }
  });
});
```

NOTE on the non-conformance-test exclusion: `src/chat/__tests__/query-router.test.ts` is under `src/` (allowlisted), so it is only excluded if the `.gitattributes` test-exclusion rules from Task 3 are present in the synthetic repo. Since this synthetic repo writes its own `.gitattributes` (`src/ text`), it does NOT carry those rules — so this file WOULD ship here. To keep this test hermetic and honest, either (a) write the real test-exclusion rules into the synthetic repo's `.gitattributes`, or (b) drop `src/chat/__tests__/query-router.test.ts` from this test and cover non-conformance-test exclusion in Task 5's real-repo verification instead. **Choose (a):** in `initStructuredRepo`, replace the `.gitattributes` write with the real rules so the invariant is genuinely tested:

```ts
  write('.gitattributes',
    'tests/** export-ignore\n' +
    '**/__tests__/** export-ignore\n' +
    '**/*.test.ts export-ignore\n' +
    '**/*.spec.ts export-ignore\n' +
    'packages/client-sdk/src/__tests__/conformance -export-ignore\n' +
    'packages/client-sdk/src/__tests__/conformance/** -export-ignore\n');
```
(With this — CONTENT globs, and the conformance dir entry un-ignored before its contents — the conformance test ships and the `src/chat/__tests__` test does not, exactly the real behavior.)

- [ ] **Step 2: Run — confirm the invariant test passes**

Run: `cd haiWeb && npx vitest run scripts/__tests__/build-agent-zip.test.ts`
Expected: all pass, including the two new cases. Two failure modes to recognize: (a) the "conformance present" assertion goes red → the `**/__tests__/**` glob is pruning the conformance dir; make sure you used content-globs (`**/__tests__/**`, not `**/__tests__/`) AND un-ignored the conformance dir entry itself (`.../conformance -export-ignore`) before `.../conformance/**`. (b) the non-conformance `src/chat/__tests__` test appears → the `**/*.test.ts` exclusion didn't apply. Do NOT weaken the assertions to force green.

- [ ] **Step 3: Commit (haiWeb)**

```bash
cd haiWeb
git add scripts/__tests__/build-agent-zip.test.ts
git commit -m "test(agent-archive): assert allowlist ships required + excludes internal"
```
End with the Co-Authored-By trailer.

---

### Task 3: `.gitattributes` — exclude tests except the conformance kit (haiClient)

**Files:**
- Modify: `haiClient/.gitattributes`

**Interfaces:**
- Produces: an archive that (with the allowlist) ships only the conformance kit among tests.

- [ ] **Step 1: Remove the 30 per-file test excludes (superseded)**

In `haiClient/.gitattributes`, delete the entire block from the comment `# Unit/integration test files whose fixtures reference demo/prospect` through the last `tests/chat/query-router.test.ts ... export-ignore` line (the ~30 per-file entries added in the prior cycle). They are made redundant by the broad rule below.

- [ ] **Step 2: Add the broad test exclusion + conformance un-ignore**

Append to `haiClient/.gitattributes`:

```gitattributes
# Ship ONLY the protocol conformance kit among tests (config guide §11.6).
# CRITICAL: use CONTENT globs (`**/__tests__/**`), NOT directory prunes
# (`**/__tests__/`). git archive will not descend into a pruned directory, so a
# nested `-export-ignore` un-ignore is never evaluated (you cannot re-include a
# file whose parent dir is excluded). And un-ignore the conformance DIR ENTRY
# ITSELF before its contents, so the dir is not pruned.
tests/**                                            export-ignore
**/__tests__/**                                     export-ignore
**/*.test.ts                                         export-ignore
**/*.spec.ts                                         export-ignore
packages/client-sdk/src/__tests__/conformance       -export-ignore
packages/client-sdk/src/__tests__/conformance/**    -export-ignore

# Dockerfile COPYs this pricing-manifest TEMPLATE (not demo data) as a config
# seed; the `config/pricing-manifests/ export-ignore` above would strip it and
# break `docker build`. Re-include just this example file.
config/pricing-manifests/company-default.example.json  -export-ignore
```

Keep all the existing demo-data `export-ignore` rules (lines 4–30) as defense-in-depth.

- [ ] **Step 3: Verify — conformance kit ships, other tests do not, via git archive with the allowlist**

Run (commit first so `git archive` sees the new `.gitattributes`; or verify against the working attributes — commit then check):
```bash
cd haiClient
git add .gitattributes && git commit -m "chore(archive): ship only the conformance kit among tests" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
ALLOW="src packages haicore-protocol frontend public config package.json package-lock.json tsconfig.json tsconfig.typecheck.json vitest.config.ts Dockerfile docker-compose.yml .dockerignore scripts/docker-entrypoint.sh scripts/seed-config.mjs scripts/hash-chat-password.mjs README.md UPGRADING.md CHANGELOG.md LICENSE .env.example .gitignore"
echo "conformance kit present? (expect files):"
git archive HEAD -- $ALLOW | tar -t | grep '__tests__/conformance/' | head
echo "any NON-conformance test shipping? (expect empty):"
git archive HEAD -- $ALLOW | tar -t | grep -E '\.test\.ts$|\.spec\.ts$' | grep -v '__tests__/conformance/' | head
```
Expected: conformance files listed; the second grep empty.

(The commit is folded into this step because the verification needs the committed `.gitattributes`.)

---

### Task 4: `test:conformance` npm script (haiClient)

**Files:**
- Modify: `haiClient/package.json`

- [ ] **Step 1: Add the script**

In `haiClient/package.json` scripts, next to `"test"`, add:
```json
    "test:conformance": "vitest run packages/client-sdk/src/__tests__/conformance/",
```

- [ ] **Step 2: Verify it runs the kit**

Run: `cd haiClient && npm run test:conformance 2>&1 | tail -8`
Expected: vitest runs the conformance suite; report the pass/fail count (should be all passing). Valid JSON preserved.

- [ ] **Step 3: Commit (haiClient)**

```bash
cd haiClient
git add package.json
git commit -m "chore(archive): add test:conformance runner for adopters"
```
End with the Co-Authored-By trailer.

---

### Task 5: End-to-end verification (real archive)

**Files:** none (verification only).

- [ ] **Step 1: Build the real archive with the allowlist; guard must pass**

Run: `cd haiWeb && AGENT_SOURCE_REPO=../haiClient node scripts/build-agent-zip.mjs`
Expected: `Built haiwave-agent-vX.Y.Z.zip ...`, no `Agent archive leak`.

- [ ] **Step 2: Confirm the archive contains ONLY allowlisted top-level entries + internal absent**

Run:
```bash
cd haiWeb
ZIP=$(ls -t private/agent-downloads/haiwave-agent-v*.zip | head -1)
echo "top-level entries:"; unzip -Z1 "$ZIP" | sed -E 's#/.*##' | sort -u
echo "internal absent? (expect empty):"; unzip -Z1 "$ZIP" | grep -E '^(CLAUDE\.md|\.gitattributes|kill-agents\.ps1|kill-all\.ps1|deploy-agent\.sh|docs/|seed-data/|test-environment/|e2e/)' | head
echo "conformance kit present? (expect files):"; unzip -Z1 "$ZIP" | grep '__tests__/conformance/' | head
echo "non-conformance tests absent? (expect empty):"; unzip -Z1 "$ZIP" | grep -E '\.test\.ts$' | grep -v conformance | head
```
Expected: top-level = allowlisted set only; internal grep empty; conformance present; non-conformance-tests grep empty.

- [ ] **Step 3: Confirm every Dockerfile COPY target is present in the archive**

`tsc` verification does not exercise the Dockerfile, so a stripped Docker asset (e.g. an export-ignored config seed the image COPYs) would be invisible. Assert each COPY source path ships:
```bash
cd haiClient
# extract the concrete source paths the Dockerfile COPYs (skip --from build-stage copies and globs)
grep -E '^COPY ' Dockerfile | grep -v -- '--from=' | awk '{print $2}' | while read -r p; do
  # only check literal file/dir paths that exist in the repo (skip '.' and globs)
  case "$p" in .|*'*'*) continue;; esac
  if git archive HEAD -- "$p" 2>/dev/null | tar -t >/dev/null 2>&1; then echo "OK   $p"; else echo "MISSING $p"; fi
done
```
Expected: every line `OK`. Any `MISSING` means the allowlist or an `export-ignore` strips a Docker-required file — fix before proceeding. (Known: `config/pricing-manifests/company-default.example.json` must be present via its `-export-ignore` from Task 3.)

- [ ] **Step 4: Confirm the adopter can run the conformance kit**

Run: `cd haiClient && npm run test:conformance 2>&1 | tail -5`
Expected: conformance suite passes.

- [ ] **Step 5: One-time under-inclusion sanity (extract + tsc)**

Run:
```bash
DEST=$(mktemp -d); ZIP=$(ls -t /Users/samfleming/dev/hw/haiWeb/private/agent-downloads/haiwave-agent-v*.zip | head -1)
unzip -q "$ZIP" -d "$DEST"; cp -Rc /Users/samfleming/dev/hw/haiClient/node_modules "$DEST/node_modules"
cd "$DEST" && npm run build 2>&1 | tail -5
```
Expected: `tsc -b` succeeds — the allowlist didn't drop a build input.

- [ ] **Step 6: Record verification in the ledger.** No commit.

---

## Self-Review

**Spec coverage:**
- Allowlist mechanism (`git archive HEAD -- <allowlist>`, maintained constant) → Task 1. ✓
- Ship/exclude sets → Task 1 constant + Global Constraints; verified Task 5. ✓
- Tests = conformance kit only (broad export-ignore + un-ignore; remove 30 per-file excludes) → Task 3. ✓
- `test:conformance` script → Task 4. ✓
- Under-inclusion invariant test → Task 2. ✓
- Denylist guard unchanged, still backstops → Task 1 leaves it intact; Task 5 Step 1. ✓
- `.gitattributes` excluded from ship set → not in allowlist (Task 1); asserted absent (Task 2, Task 5). ✓

**Placeholder scan:** No TBD/TODO. Task 2 explicitly resolves the `.gitattributes`-in-synthetic-repo subtlety inline (option (a)). ✓

**Type/name consistency:** `ALLOWLIST` name consistent between Task 1 module and Task 2 import. `allowlist` param name consistent. The `.gitattributes` rule order (broad `export-ignore` before conformance `-export-ignore`) is stated in both Task 2's synthetic repo and Task 3's real rules. ✓

**Risk note:** the `-export-ignore` un-ignore is the one mechanism that could behave unexpectedly across git versions; Task 2 (hermetic) and Task 3/Task 5 (real) both verify it empirically, so a failure surfaces as a red test, not a silent leak.
