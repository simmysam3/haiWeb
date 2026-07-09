# Strip Demo Fingerprint from Agent Archive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all prospect/demo company sample data from the distributed haiClient agent archive while keeping it in the repo for local demo builds, backstopped by a fail-closed build guard.

**Architecture:** Three coordinated mechanisms in haiClient — `.gitattributes` `export-ignore` (omit whole files from `git archive`), in-place source scrubs (files that must ship), and a demote of `seed-lead-time-history` to a local script — plus a denylist guard inside haiWeb's `build-agent-zip.mjs` that throws at build time on any company-name hit in the produced zip. The guard is the guarantee; the strip-list is the starting point. A comment-only scrub in haiCore's protocol source (re-synced into haiClient) keeps the functional `vomero` types fingerprint-free.

**Tech Stack:** Node ESM scripts (`.mjs`), TypeScript (strict), Vitest (node env), `git archive`, `.gitattributes`, DuckDB (raw `duckdb` node driver for the demoted seed script).

## Global Constraints

- Spec: `haiWeb/docs/superpowers/specs/2026-07-09-strip-demo-fingerprint-agent-archive-design.md`.
- Axis: **keep functional mechanism, strip company sample data.** Never strip by the "vomero" label — strip by content.
- Never resurrect anything from the thrown-out demo branch.
- Repos: haiClient (bulk), haiWeb (`build-agent-zip.mjs` guard), haiCore (vomero doc-comment scrub only). Commit per repo separately.
- TDD applies to behavior (the guard, the demote script). `.gitattributes`, `package.json`, `.dockerignore`, and comment edits are config/docs — verify by inspection/`git archive`, no unit test required (per user's TDD exceptions).
- Company denylist (the canonical list every task serves), curated for specificity to avoid false positives:
  - **Full names / prefixes (high-specificity):** `Amphenol`, `Apex Manufacturing`, `Apex Brass`, `Summit Electrical`, `Precision Plastics`, `Delta Flow`, `Lyn-?Tron`, `Great Lakes Hardware`, `MidWest Fastener`, `National Industrial`, `Pacific Safety`, `W\.?M\.? Gore`, `Huntwood`, `US ?Steel`, `SEL Inc`, `selinc`, `deltaflow`, `greatlakes`, `lyntron`, `ussteel`, `eg4`
  - **Product-ID prefixes:** `LYN-`, `APEX-`, `MWF-`, `NIS-`, `PSP-`, `ANS-`, `SEC-`, `PPC-`, `DFS-`, `GORE-`, `GLH-`
  - **Demo cast:** `\bNike\b`, `\bOIA\b`, `\bCSG\b`, `vomero`
  - **Demo participant UUIDs:** `8b7ecca6-b704-4d2b-896c-801898135fdf`, `e755e710-0680-42d2-a9ee-938456ec7e69`, `ec2308a1-08e4-4f87-bf39-43fb98bef8ff`, `3513cae6-f196-4c79-b2cd-3a508770ad5c`, `32509c89-d9ff-4d4a-b11e-8b09d47b2287`, `2de15fcf-f0fc-45ae-8702-1650f8fd45ae`
  - Do NOT include bare `beta`, `apex`, `gore`, `summit`, `ti` as standalone tokens (too many false positives); catch those companies via their full-name / prefix / UUID patterns above.

---

### Task 1: Fail-closed denylist guard in the build script

**Files:**
- Create: `haiWeb/scripts/lib/agent-archive-denylist.mjs`
- Modify: `haiWeb/scripts/build-agent-zip.mjs` (add scan after `git archive`, before manifest write)
- Test: `haiWeb/scripts/__tests__/build-agent-zip.test.ts` (append cases)

**Interfaces:**
- Produces: `DENYLIST: RegExp[]` (exported from the lib), and `scanZipForDenylist(zipPath): {file: string, term: string}[]` (exported from `build-agent-zip.mjs`). `buildAgentZip(...)` now throws `Error` whose message starts with `Agent archive leak:` when the produced zip contains any denylist hit.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Write the denylist module**

Create `haiWeb/scripts/lib/agent-archive-denylist.mjs`:

```js
/**
 * Company/demo fingerprint patterns that must never appear in the distributed
 * agent archive. Curated for specificity — bare common tokens (beta, apex, gore,
 * ti) are intentionally omitted; those companies are caught via full-name,
 * product-prefix, or UUID patterns to avoid false positives on ordinary words.
 * Keep in sync with the spec's denylist and the haiClient seed-data companies.
 */
export const DENYLIST = [
  // Full names / slugs
  /amphenol/i, /apex\s+manufacturing/i, /apex\s+brass/i, /summit\s+electrical/i,
  /precision\s+plastics/i, /delta\s*flow/i, /lyn-?tron/i, /great\s+lakes\s+hardware/i,
  /midwest\s+fastener/i, /national\s+industrial/i, /pacific\s+safety/i, /w\.?m\.?\s*gore/i,
  /huntwood/i, /us\s?steel/i, /sel\s+inc/i, /selinc/i, /deltaflow/i, /greatlakes/i,
  /lyntron/i, /ussteel/i, /\beg4\b/i,
  // Product-ID prefixes
  /\bLYN-/, /\bAPEX-/, /\bMWF-/, /\bNIS-/, /\bPSP-/, /\bANS-/, /\bSEC-/, /\bPPC-/,
  /\bDFS-/, /\bGORE-/, /\bGLH-/,
  // Demo cast
  /\bnike\b/i, /\boia\b/i, /\bcsg\b/i, /vomero/i,
  // Demo participant UUIDs
  /8b7ecca6-b704-4d2b-896c-801898135fdf/i,
  /e755e710-0680-42d2-a9ee-938456ec7e69/i,
  /ec2308a1-08e4-4f87-bf39-43fb98bef8ff/i,
  /3513cae6-f196-4c79-b2cd-3a508770ad5c/i,
  /32509c89-d9ff-4d4a-b11e-8b09d47b2287/i,
  /2de15fcf-f0fc-45ae-8702-1650f8fd45ae/i,
];
```

- [ ] **Step 2: Write the failing test (planted fingerprint must throw)**

Append to `haiWeb/scripts/__tests__/build-agent-zip.test.ts`:

```ts
  it('throws when the archive contains a demo company fingerprint', () => {
    const repo = initRepo();
    const git = (...a: string[]) => execFileSync('git', ['-C', repo, ...a], { stdio: 'pipe' });
    // Plant a tracked file that names a demo company.
    writeFileSync(join(repo, 'leak.ts'), '// example from an Amphenol search\n');
    git('add', '-A');
    git('commit', '-qm', 'plant');
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out })).toThrow(/Agent archive leak/);
  });

  it('succeeds and reports no leak for a clean repo', () => {
    const repo = initRepo();
    const out = tmp('agentzip-out-');
    expect(() => buildAgentZip({ repoPath: repo, outDir: out })).not.toThrow();
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd haiWeb && npx vitest run scripts/__tests__/build-agent-zip.test.ts`
Expected: the "throws when the archive contains a demo company fingerprint" case FAILS (no throw yet — guard not implemented).

- [ ] **Step 4: Implement the guard in the build script**

In `haiWeb/scripts/build-agent-zip.mjs`, add the import at top:

```js
import { DENYLIST } from './lib/agent-archive-denylist.mjs';
```

Add this exported helper above `buildAgentZip`:

```js
/**
 * Scan a produced zip for denylisted fingerprints by streaming each entry's
 * text via `unzip -p`. Returns every (file, matched-term) hit.
 */
export function scanZipForDenylist(zipPath) {
  const listing = execFileSync('unzip', ['-Z1', zipPath]).toString().split('\n').filter(Boolean);
  const hits = [];
  for (const entry of listing) {
    if (entry.endsWith('/')) continue;
    let text;
    try {
      text = execFileSync('unzip', ['-p', zipPath, entry], { maxBuffer: 64 * 1024 * 1024 }).toString();
    } catch {
      continue; // binary/unreadable entry — skip
    }
    for (const re of DENYLIST) {
      const m = text.match(re);
      if (m) hits.push({ file: entry, term: m[0] });
    }
  }
  return hits;
}
```

Then in `buildAgentZip`, after the `execFileSync('git', ['-C', repo, 'archive', ...])` line and before building `manifest`, insert:

```js
  const leaks = scanZipForDenylist(zipPath);
  if (leaks.length > 0) {
    const detail = leaks.slice(0, 20).map((h) => `  ${h.file}: "${h.term}"`).join('\n');
    throw new Error(`Agent archive leak: ${leaks.length} denylisted fingerprint(s) in ${zipFile}:\n${detail}`);
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd haiWeb && npx vitest run scripts/__tests__/build-agent-zip.test.ts`
Expected: all cases PASS (planted-name throws; clean repo does not; existing archive/manifest cases still green).

- [ ] **Step 6: Commit (haiWeb)**

```bash
cd haiWeb
git add scripts/lib/agent-archive-denylist.mjs scripts/build-agent-zip.mjs scripts/__tests__/build-agent-zip.test.ts
git commit -m "feat(agent-archive): fail-closed denylist guard in build-agent-zip"
```

---

### Task 2: `.gitattributes` export-ignore for company-data files (haiClient)

**Files:**
- Create: `haiClient/.gitattributes`

**Interfaces:**
- Produces: a `git archive HEAD` that omits every listed path. Later tasks / the guard rely on these paths being absent from the zip.
- Consumes: nothing.

- [ ] **Step 1: Create `.gitattributes`**

Create `haiClient/.gitattributes`:

```gitattributes
# Demo/prospect sample data — kept in the repo for local demo builds, excluded
# from the distributed agent archive (git archive) via export-ignore. See
# haiWeb spec 2026-07-09-strip-demo-fingerprint-agent-archive-design.md.
seed-data/                       export-ignore
seed-products.mjs                export-ignore
config/operations-manifests/     export-ignore
config/pricing-manifests/        export-ignore
config/posture-config-selinc.json export-ignore
scripts/bom-fixtures/            export-ignore
scripts/lib/vendor-facilities.ts export-ignore
scripts/count-products.ts        export-ignore
scripts/seed-*.ts                export-ignore
test-environment/                export-ignore
```

- [ ] **Step 2: Verify the paths are excluded from the archive**

Run:
```bash
cd haiClient
git archive HEAD | tar -t | grep -E '^(seed-data/|config/operations-manifests/|config/pricing-manifests/|config/posture-config-selinc.json|scripts/bom-fixtures/|scripts/lib/vendor-facilities.ts|scripts/count-products.ts|test-environment/|seed-products.mjs)' | head
```
Expected: **no output** (all excluded). If any path prints, its `.gitattributes` line is wrong — fix and re-run.

- [ ] **Step 3: Verify the files still exist locally (nothing deleted)**

Run: `cd haiClient && ls seed-data/apex/products.json scripts/lib/vendor-facilities.ts test-environment/ >/dev/null && echo LOCAL_OK`
Expected: `LOCAL_OK`

- [ ] **Step 4: Commit (haiClient)**

```bash
cd haiClient
git add .gitattributes
git commit -m "chore(archive): export-ignore demo company data from git archive"
```

---

### Task 3: Source scrubs for files that must ship (haiClient)

**Files:**
- Modify: `haiClient/package.json` (remove company `dev:*` aliases)
- Modify: `haiClient/packages/client-sdk/src/chat/sub-intent-executor.ts:126-127`
- Modify: `haiClient/.dockerignore:35`

**Interfaces:**
- Consumes: nothing. Produces: these shipping files carry no denylisted term.

- [ ] **Step 1: Remove company dev aliases from `package.json`**

Delete these six lines from the `scripts` block (lines 32–37):

```json
    "dev:selinc": "tsx watch --env-file=.env.agent6 src/index.ts",
    "dev:huntwood": "tsx watch --env-file=.env.agent8 src/index.ts",
    "dev:ti": "tsx watch --env-file=.env.agent2 src/index.ts",
    "dev:ussteel": "tsx watch --env-file=.env.agent12 src/index.ts",
    "dev:amphenol": "tsx watch --env-file=.env.agent11 src/index.ts",
    "dev:hotstart": "tsx watch --env-file=.env.hotstart src/index.ts",
```

The generic `dev:agent1`..`dev:agent13` aliases remain — the named ones are just conveniences that map to the same env files.

- [ ] **Step 2: Genericise the comment example in `sub-intent-executor.ts`**

Replace lines 126–127:

```ts
  // spacers?" after an Amphenol search gets tunneled to and answered BY
  // Amphenol. Reset the sticky vendor focus so it's answered locally.
```

with:

```ts
  // spacers?" after a vendor-specific search gets tunneled to and answered BY
  // that vendor. Reset the sticky vendor focus so it's answered locally.
```

- [ ] **Step 3: Remove the selinc line from `.dockerignore`**

Delete line 35 (`config/posture-config-selinc.json`). It is redundant now that the path is export-ignored, and it is itself a fingerprint.

- [ ] **Step 4: Verify the reference-agent + client-sdk still build**

Run: `cd haiClient && npm run build`
Expected: build succeeds (these are comment/alias/ignore edits — no type impact).

- [ ] **Step 5: Commit (haiClient)**

```bash
cd haiClient
git add package.json packages/client-sdk/src/chat/sub-intent-executor.ts .dockerignore
git commit -m "chore(archive): scrub company names from shipping files"
```

---

### Task 4: Demote `seed-lead-time-history` to a local script (haiClient)

**Files:**
- Modify: `haiClient/packages/reference-agent/src/index.ts:12` (remove barrel re-export)
- Modify: `haiClient/src/app.ts:48` (remove import), `:302-311` (remove gated boot call block)
- Delete: `haiClient/packages/reference-agent/src/db/seed-lead-time-history.ts`
- Create: `haiClient/scripts/seed-lead-time-history.ts` (self-contained, raw `duckdb`)
- Modify: `haiClient/package.json` (add `seed:leadtime` script)

**Interfaces:**
- Consumes: the demo denylist (Task 1) will scan the produced zip; `scripts/seed-*.ts` export-ignore (Task 2) covers the new script.
- Produces: a runnable `npm run seed:leadtime -- --env=.env.agentN`. Removes `seedLeadTimeHistory` from the `@haiwave/reference-agent` public API.

- [ ] **Step 1: Write the failing build check (barrel must not export the seeder)**

This task's "test" is the type build: after removing the file, `tsc -b` must stay green, which fails first because `index.ts` and `app.ts` still reference the deleted module. Do the removals in Steps 2–4, then Step 5 is the green check. First, delete the file to make the failure concrete:

Run: `cd haiClient && rm packages/reference-agent/src/db/seed-lead-time-history.ts && npm run build`
Expected: FAIL — `index.ts` / `app.ts` reference the missing module.

- [ ] **Step 2: Remove the barrel re-export**

In `haiClient/packages/reference-agent/src/index.ts`, delete line 12:

```ts
export { seedLeadTimeHistory } from './db/seed-lead-time-history.js';
```

- [ ] **Step 3: Remove the import and boot call in `app.ts`**

Delete the import at `haiClient/src/app.ts:48`:

```ts
import { seedLeadTimeHistory } from '@haiwave/reference-agent';
```

Delete the gated boot block at `haiClient/src/app.ts:302-311`:

```ts
  // Seed lead-time demo history only for opt-in demo agents (SEED_DEMO_DATA).
  // It clears DEMO-* events and re-inserts fresh ones, so a production agent
  // must not run it on boot.
  if (env.SEED_DEMO_DATA) {
    try {
      await seedLeadTimeHistory(dbAdapter, env.PARTICIPANT_ID, app.log);
    } catch (err) {
      app.log.warn({ err }, 'Lead time history seed failed — agent will start without demo history');
    }
  }
```

(`env.SEED_DEMO_DATA` is still consumed by `seedWatcherDemoData` at `app.ts:466`, so the env var stays valid.)

- [ ] **Step 4: Create the standalone script**

Create `haiClient/scripts/seed-lead-time-history.ts`. It ports the seeding logic to the raw-`duckdb` pattern used by `scripts/seed-origin-distribution.ts` (no `@haiwave/reference-agent` coupling), with a self-contained SQL escape:

```ts
/**
 * Seed an agent's local DuckDB transaction_events with order_placed →
 * order_fulfilled pairs for lead-time calibration demo data. Local demo tool
 * only (export-ignored from the distributed archive).
 *
 * Run:
 *   npm run seed:leadtime -- --env=.env.agent1
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import duckdb from 'duckdb';

const MS_PER_DAY = 86_400_000;
const esc = (s: string): string => s.replace(/'/g, "''");

interface LineProfile {
  baseDays: number; varianceDays: number; minOrders: number; maxOrders: number;
  fulfillmentClass: 'stock' | 'make_to_order' | 'custom';
}

// Lead-time profiles by product-ID prefix (demo companies).
const LINE_PROFILES: Record<string, LineProfile> = {
  'LYN-RS':  { baseDays: 3,  varianceDays: 1, minOrders: 8,  maxOrders: 18, fulfillmentClass: 'stock' },
  'LYN-HS':  { baseDays: 5,  varianceDays: 2, minOrders: 7,  maxOrders: 14, fulfillmentClass: 'stock' },
  'LYN-MF':  { baseDays: 8,  varianceDays: 2, minOrders: 5,  maxOrders: 12, fulfillmentClass: 'make_to_order' },
  'LYN-FF':  { baseDays: 10, varianceDays: 3, minOrders: 4,  maxOrders: 10, fulfillmentClass: 'make_to_order' },
  'LYN-MM':  { baseDays: 7,  varianceDays: 2, minOrders: 5,  maxOrders: 11, fulfillmentClass: 'make_to_order' },
  'LYN-SW':  { baseDays: 4,  varianceDays: 1, minOrders: 6,  maxOrders: 15, fulfillmentClass: 'stock' },
  'LYN-SH':  { baseDays: 6,  varianceDays: 2, minOrders: 5,  maxOrders: 12, fulfillmentClass: 'make_to_order' },
  'LYN-NAS': { baseDays: 12, varianceDays: 3, minOrders: 4,  maxOrders: 8,  fulfillmentClass: 'custom' },
  'LYN-CP':  { baseDays: 9,  varianceDays: 2, minOrders: 5,  maxOrders: 10, fulfillmentClass: 'make_to_order' },
  'LYN-JS':  { baseDays: 7,  varianceDays: 2, minOrders: 5,  maxOrders: 10, fulfillmentClass: 'make_to_order' },
  'LYN-TS':  { baseDays: 5,  varianceDays: 1, minOrders: 6,  maxOrders: 12, fulfillmentClass: 'stock' },
  'APEX-':   { baseDays: 3,  varianceDays: 1, minOrders: 8,  maxOrders: 20, fulfillmentClass: 'stock' },
  'MWF-':    { baseDays: 2,  varianceDays: 1, minOrders: 10, maxOrders: 25, fulfillmentClass: 'stock' },
  'NIS-SAF': { baseDays: 3,  varianceDays: 1, minOrders: 6,  maxOrders: 15, fulfillmentClass: 'stock' },
  'NIS-SF':  { baseDays: 3,  varianceDays: 1, minOrders: 6,  maxOrders: 15, fulfillmentClass: 'stock' },
  'NIS-':    { baseDays: 4,  varianceDays: 2, minOrders: 5,  maxOrders: 12, fulfillmentClass: 'stock' },
  'PSP-':    { baseDays: 3,  varianceDays: 1, minOrders: 6,  maxOrders: 14, fulfillmentClass: 'stock' },
  'ANS-C2E': { baseDays: 7,  varianceDays: 2, minOrders: 5,  maxOrders: 12, fulfillmentClass: 'make_to_order' },
  'ANS-':    { baseDays: 5,  varianceDays: 2, minOrders: 5,  maxOrders: 10, fulfillmentClass: 'make_to_order' },
  'SEC-':    { baseDays: 4,  varianceDays: 1, minOrders: 6,  maxOrders: 14, fulfillmentClass: 'stock' },
  'PPC-':    { baseDays: 10, varianceDays: 3, minOrders: 4,  maxOrders: 10, fulfillmentClass: 'make_to_order' },
  'DFS-':    { baseDays: 8,  varianceDays: 2, minOrders: 4,  maxOrders: 10, fulfillmentClass: 'make_to_order' },
  'GORE-':   { baseDays: 14, varianceDays: 4, minOrders: 3,  maxOrders: 8,  fulfillmentClass: 'custom' },
  'GLH-':    { baseDays: 2,  varianceDays: 1, minOrders: 8,  maxOrders: 20, fulfillmentClass: 'stock' },
};
const DEFAULT_PROFILE: LineProfile = { baseDays: 5, varianceDays: 2, minOrders: 5, maxOrders: 10, fulfillmentClass: 'make_to_order' };
const BUYER_PIDS = [
  '8b7ecca6-b704-4d2b-896c-801898135fdf',
  'e755e710-0680-42d2-a9ee-938456ec7e69',
  'ec2308a1-08e4-4f87-bf39-43fb98bef8ff',
  '3513cae6-f196-4c79-b2cd-3a508770ad5c',
];
const TRENDS: Array<'improving' | 'stable' | 'degrading'> = ['improving', 'stable', 'stable', 'degrading'];

function getProfile(productId: string): LineProfile {
  for (const [prefix, profile] of Object.entries(LINE_PROFILES)) {
    if (productId.startsWith(prefix)) return profile;
  }
  return DEFAULT_PROFILE;
}
function generateLeadDays(base: number, variance: number, progress: number, trend: string): number {
  let adjusted = base;
  if (trend === 'improving') adjusted -= progress * 1.5;
  if (trend === 'degrading') adjusted += progress * 1.5;
  const noise = (Math.random() - 0.5) * 2 * variance;
  return Math.max(1, Math.round(adjusted + noise));
}
function readEnvVar(envFile: string, key: string): string | undefined {
  const text = readFileSync(envFile, 'utf8');
  const m = text.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)\\s*$`, 'm'));
  if (!m) return undefined;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  return v;
}
function dbAll<T = unknown>(db: duckdb.Database, sql: string): Promise<T[]> {
  return new Promise((res, rej) => db.all(sql, (e: Error | null, r: T[]) => (e ? rej(e) : res(r ?? []))));
}
function dbRun(db: duckdb.Database, sql: string): Promise<void> {
  return new Promise((res, rej) => db.run(sql, (e: Error | null) => (e ? rej(e) : res())));
}

async function main(): Promise<void> {
  const envArg = process.argv.slice(2).find((a) => a.startsWith('--env='));
  if (!envArg) throw new Error('Missing required --env=<path> argument');
  const envAbs = resolve(process.cwd(), envArg.slice('--env='.length));
  const participantId = readEnvVar(envAbs, 'PARTICIPANT_ID');
  const dbPathRaw = readEnvVar(envAbs, 'DUCKDB_PATH');
  if (!participantId) throw new Error(`PARTICIPANT_ID missing from ${envAbs}`);
  if (!dbPathRaw) throw new Error(`DUCKDB_PATH missing from ${envAbs}`);
  const dbPath = resolve(process.cwd(), dbPathRaw);

  const db: duckdb.Database = await new Promise((res, rej) => {
    const inst = new duckdb.Database(dbPath, (e: Error | null) => (e ? rej(e) : res(inst)));
  });
  try {
    const probe = await dbAll<{ product_id: string }>(db, 'SELECT product_id FROM products LIMIT 1');
    if (probe.length === 0) { console.log('[seed-leadtime] no products — skipping'); return; }
    const products = await dbAll<{ product_id: string }>(db, 'SELECT product_id FROM products WHERE is_active = true');
    await dbRun(db, `DELETE FROM transaction_events WHERE transaction_id LIKE 'DEMO-%'`);

    const now = Date.now();
    const values: string[] = [];
    for (const p of products) {
      const profile = getProfile(p.product_id);
      const orderCount = profile.minOrders + Math.floor(Math.random() * (profile.maxOrders - profile.minOrders + 1));
      const trend = TRENDS[Math.floor(Math.random() * TRENDS.length)];
      for (let i = 0; i < orderCount; i++) {
        const orderId = randomUUID();
        const txId = `DEMO-${p.product_id}-${i}`;
        const buyerId = BUYER_PIDS[i % BUYER_PIDS.length];
        const daysAgo = Math.floor(180 * (1 - i / orderCount));
        const orderDate = new Date(now - daysAgo * MS_PER_DAY);
        const leadDays = generateLeadDays(profile.baseDays, profile.varianceDays, i / orderCount, trend);
        const fulfillDate = new Date(orderDate.getTime() + leadDays * MS_PER_DAY);
        const qty = 50 + Math.floor(Math.random() * 500);
        values.push(`('${randomUUID()}', '${esc(txId)}', '${orderId}', 'order_placed', '${esc(participantId)}', '${buyerId}', '${esc(JSON.stringify({ product_id: p.product_id, quantity: qty }))}', '${orderDate.toISOString()}')`);
        values.push(`('${randomUUID()}', '${esc(txId)}-f', '${orderId}', 'order_fulfilled', '${esc(participantId)}', '${buyerId}', '${esc(JSON.stringify({ product_id: p.product_id, lead_days_actual: leadDays }))}', '${fulfillDate.toISOString()}')`);
      }
    }
    if (values.length === 0) { console.log('[seed-leadtime] no events to seed'); return; }
    const BATCH = 500;
    for (let off = 0; off < values.length; off += BATCH) {
      await dbRun(db, `INSERT INTO transaction_events (id, transaction_id, order_id, event_type, participant_id, counterparty_id, payload, occurred_at) VALUES ${values.slice(off, off + BATCH).join(',\n')}`);
    }
    console.log(`[seed-leadtime] seeded ${values.length} events for ${products.length} products`);
  } finally {
    await new Promise<void>((res) => db.close(() => res()));
  }
}

main().catch((err) => { console.error('[seed-leadtime] failed:', err); process.exit(1); });
```

- [ ] **Step 5: Add the `seed:leadtime` package script**

In `haiClient/package.json` scripts block, next to the other `seed:*` entries, add:

```json
    "seed:leadtime": "tsx scripts/seed-lead-time-history.ts",
```

- [ ] **Step 6: Verify the build is green again**

Run: `cd haiClient && npm run build`
Expected: PASS — nothing references the removed module; the new script typechecks.

- [ ] **Step 7: Verify the relocated script runs against a demo agent DB**

Run: `cd haiClient && npm run seed:leadtime -- --env=.env.agent1`
Expected: prints `[seed-leadtime] seeded N events for M products` (or the no-products skip line). No crash.

- [ ] **Step 8: Verify the script is export-ignored (absent from the archive)**

Run: `cd haiClient && git archive HEAD | tar -t | grep 'scripts/seed-lead-time-history.ts' || echo EXCLUDED_OK`
Expected: `EXCLUDED_OK`

- [ ] **Step 9: Commit (haiClient)**

```bash
cd haiClient
git add packages/reference-agent/src/index.ts src/app.ts packages/reference-agent/src/db/seed-lead-time-history.ts scripts/seed-lead-time-history.ts package.json
git commit -m "refactor(archive): demote lead-time seeder to a local-only script"
```

---

### Task 5: Scrub company names from the functional `vomero` protocol types (haiCore → re-sync haiClient)

**Files:**
- Modify: `haiCore/packages/protocol/src/vomero/readiness.ts` (doc-comment prose only)
- Regenerate + re-sync: `haiClient/haicore-protocol/dist/vomero/*`

**Interfaces:**
- Consumes: nothing. Produces: the shipped `vomero` types carry no `Nike`/`OIA`/`CSG` prose, so the Task 1 guard passes strict on them while the functional types are preserved.

- [ ] **Step 1: Find the company references in the protocol source**

Run: `cd haiCore && grep -rniE 'nike|\boia\b|\bcsg\b' packages/protocol/src/vomero/`
Expected: a small number of doc-comment lines (e.g. "the seller/CSG-side view", "what rolls up to OIA and Nike, spec §6.3").

- [ ] **Step 2: Genericise each matched doc-comment**

Edit each matched line to remove the company names while preserving the technical meaning. Examples:
- `One resolved component line — the seller/CSG-side view` → `One resolved component line — the seller-side view`
- `What rolls up the relationship chain to OIA and Nike (spec §6.3)` → `What rolls up the relationship chain to the downstream buyer (spec §6.3)`

These are comments only — do not change any type names, fields, or values.

- [ ] **Step 3: Rebuild the protocol package**

Run: `cd haiCore && npm run build -w @haiwave/protocol` (or the repo's protocol build command)
Expected: PASS; the generated `dist/vomero/*` no longer contains the names.

- [ ] **Step 4: Commit (haiCore)**

```bash
cd haiCore
git add packages/protocol/src/vomero/
git commit -m "chore(protocol): remove demo company names from vomero doc-comments"
```

- [ ] **Step 5: Re-sync the vendored protocol into haiClient**

Run: `cd haiClient && npm run sync:protocol && npm install`
Expected: `haicore-protocol/dist/vomero/*` updated with the scrubbed comments.

- [ ] **Step 6: Verify the vendored copy is clean and haiClient builds**

Run: `cd haiClient && grep -rniE 'nike|\boia\b|\bcsg\b' haicore-protocol/dist/vomero/ || echo CLEAN; npm run build`
Expected: `CLEAN` then a passing build.

- [ ] **Step 7: Commit the vendored re-sync (haiClient)**

```bash
cd haiClient
git add haicore-protocol/
git commit -m "chore(protocol): re-sync vendored protocol (vomero doc-comment scrub)"
```

---

### Task 6: End-to-end verification against the real archive

**Files:** none (verification only). Produces the sign-off evidence.

- [ ] **Step 1: Build the real archive from haiClient and confirm the guard passes**

Run: `cd haiWeb && AGENT_SOURCE_REPO=../haiClient node scripts/build-agent-zip.mjs`
Expected: prints `Built haiwave-agent-vX.Y.Z.zip (... bytes) ...` with **no** `Agent archive leak` error. If it throws, read the listed files, add the missing path to `.gitattributes` (Task 2) or scrub the source (Task 3), and re-run.

- [ ] **Step 2: Independent sweep — grep the extracted archive directly**

Run:
```bash
cd haiWeb && rm -rf /tmp/agent-verify && unzip -q private/agent-downloads/haiwave-agent-v*.zip -d /tmp/agent-verify
grep -rniE 'amphenol|selinc|deltaflow|greatlakes|lyntron|ussteel|huntwood|\beg4\b|lyn-?tron|great lakes hardware|delta flow|\bLYN-|\bAPEX-|\bGORE-|\bnike\b|\boia\b|\bcsg\b|vomero|8b7ecca6-b704-4d2b-896c-801898135fdf' /tmp/agent-verify || echo SWEEP_CLEAN
```
Expected: `SWEEP_CLEAN`.

- [ ] **Step 2b: Confirm functional keeps are still present**

Run: `ls /tmp/agent-verify/packages/reference-agent/src/db/seed-watcher-demo-data.ts /tmp/agent-verify/haicore-protocol/dist/vomero/ >/dev/null && echo KEEPS_PRESENT`
Expected: `KEEPS_PRESENT` (functional watcher seeder + vomero types shipped).

- [ ] **Step 3: Boot-smoke the extracted archive**

Run:
```bash
cd /tmp/agent-verify && npm ci && npm run build
# configure a minimal .env (PARTICIPANT_ID, DUCKDB_PATH, KEYCLOAK_*, LLM_PROVIDER) then:
npm start &
sleep 8 && curl -sf localhost:3000/health && echo BOOT_OK
kill %1
```
Expected: `BOOT_OK` — the stripped archive compiles and boots. (If `/health` port differs per env, use the configured port.)

- [ ] **Step 4: Record the verification**

Note the archive version, guard result, and sweep result in the session bootstrap/memory. No commit (verification only).

---

## Self-Review

**Spec coverage:**
- Mechanism #1 export-ignore → Task 2. ✓
- Mechanism #2 source scrub → Task 3. ✓
- Mechanism #3 seed-lead-time-history demote → Task 4. ✓
- Mechanism #4 fail-closed guard → Task 1 (moved into `build-agent-zip.mjs` per the plan's refinement; spec said the test file — the guard now lives in the build script and is tested there). ✓
- Keep: watcher seeder (untouched, verified Task 6 Step 2b) + vomero types (scrubbed comments Task 5, verified present Task 6). ✓
- Strip-list (seed-data, config manifests, posture-config, bom-fixtures, vendor-facilities, count-products, seed-*, seed-products.mjs, test-environment) → Task 2. ✓
- Verification (guard, boot-smoke, ls-files sweep) → Task 6. ✓
- Open recommendation (allowlist scripts/ + test-environment/) → intentionally deferred, noted in spec; not a task. ✓

**Placeholder scan:** No TBD/TODO. The demote script and guard are shown in full. The vomero comment edits are shown as concrete before→after examples (exact lines depend on the source grep in Step 1, which is why Step 1 locates them first). ✓

**Type consistency:** `scanZipForDenylist`/`DENYLIST` names match between Task 1 lib and build script. The demote script is self-contained (no cross-task type dependency). `env.SEED_DEMO_DATA` still referenced by the watcher seeder after Task 4 removes the lead-time block. ✓

**Note on TDD:** Config/comment tasks (2, 3, 5) verify by `git archive`/`grep`/build rather than unit tests, per the user's stated TDD exceptions for config/docs. The two behavior changes (guard Task 1, demote Task 4) follow red→green. ✓
