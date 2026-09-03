# Catalog descriptors on the origin manifest — haiCore + protocol Implementation Plan (v1.85 PR 3, part 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A vendor's brand, model, family and short description ride its origin manifest to Central and come back on the counterparty catalog and on audit-run results, so an auditor's SKU rows can say what a product is.

**Architecture:** Protocol 3.81.0 adds four optional nullable fields to the manifest submit/read schemas and `product_name` plus the same four to `AuditRunResultSchema`. Migration 0047 adds four nullable `text` columns to `origin_manifests`. `createOrUpdateManifest` stores exactly what was sent on every new version; the catalog's existing latest-manifest lateral join selects the four; `AuditRunService.getResults` gains a lateral join to the vendor's latest manifest. No new endpoint, job, scope or classifier path.

**Tech Stack:** Node 26, TypeScript, Fastify, drizzle-orm 0.45.2 (postgres-js; `leftJoinLateral` verified to typecheck and render valid Postgres), hand-written SQL migrations under `apps/core/drizzle/`, zod protocol package, vitest. Dev Postgres on :5433 (docker `infrastructure-postgres-1`).

**Spec:** `docs/superpowers/specs/2026-09-03-catalog-descriptors-on-origin-manifest-design.md` (HaiWeb repo, branch `v1.85-catalog-descriptors`, 5069bc8; owner-approved 2026-09-03). Read §2, §3, §4 first; §8 lists the behaviours the tests pin.

## Global Constraints

- Worktree `/Users/samfleming/dev/hw/haiCore-v185`, NEW branch `v1.85-catalog-descriptors` from `origin/main` (Task 1 Step 1; `origin/main` = 2efd0117 on 2026-09-03; the worktree tree is byte-identical to it). Every command starts with `cd /Users/samfleming/dev/hw/haiCore-v185…` or `git -C /Users/samfleming/dev/hw/haiCore-v185`. The primary `~/dev/hw/haiCore` is Central's RUNNING source tree — never edit, check out, build or install there; never `git checkout main` in the worktree.
- **Counters ON HOLD with agent1 (`hw-db`), UNSPENT:** migration **0047**, protocol **3.81.0**, decision **D-207**, register **v1.53**. D-207 appears in the first test's comment and 0047 in its filename, so the CONTROLLER asks `hw-db` to release ALL FOUR for this plan **before Task 1 Step 2** and reports each first write by message (0047 → Task 1; 3.81.0 → Task 2; D-207 + v1.53 → Task 6). With that request the controller states: "3.81.0 will NOT carry the §P docket parked at 3.80.0; it moves to 3.82.0" and waits for confirmation. If hw-db re-allocates, search-and-replace this plan before starting; executors never invent a number.
- Tests hit the LANE database only: every vitest under `apps/core` is prefixed `TEST_DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test` (`vitest.config.ts` reads `TEST_DATABASE_URL`; a `DATABASE_URL=` prefix is silently ignored and hits the shared `haiwave_test`). `npm run db:apply` reads `DATABASE_URL` from the worktree `.env`, pinned to the lane DB (Task 1 Step 1 re-checks).
- Every vitest runs through agent1's machine-wide mutex, env prefix first: `TEST_DATABASE_URL=… /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run <files> --maxWorkers=3 --minWorkers=1` (mkdir lock `/tmp/hw-vitest.lock`, exit status propagated). Gates FOREGROUND; the controller still announces the Task 7 whole-suite gate to `hw-db`.
- Typechecks: `npm run build` covers non-test source only (`apps/core/tsconfig.json` excludes `src/**/*.test.ts` and `src/test-utils/**`); test files go through the ratchet `cd apps/core && npm run typecheck:tests` (baseline `typecheck-tests.baseline` = **401** errors, zero headroom — one new test-file type error fails it). Read exit codes on the next line (`echo "exit=$?"`). `(retry x` in a green run is NOT green.
- Semantics (spec §2): every manifest version is a full statement — store exactly what was sent, `null` when absent; readers show the LATEST version per (participant, product). `family` is the vendor's product line; `manufacturer_part_number` and `network_index.brand` / `family_id` stay untouched. The audit result hash (`audit-result-hash.ts`, an explicit five-field allowlist) excludes the descriptors; the two `persistedResults` sites in `audit-run-service.ts` (`:384`, `:845`) stay unchanged.
- Comments dated `v1.85 (2026-09-03)` citing D-207, one sentence of why. Wire snake_case. No `any`. Protocol additive only. Commit after every green task; messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg`. **No push / PR / merge / tag / deploy** — Task 7 HOLDS for the owner. Re-read `git log --oneline origin/main..HEAD` before every package (a stop-time hook may add commits).

---

### Task 1: Branch; migration 0047; schema columns; seed helper

**Files:**
- Create: `apps/core/drizzle/0047_origin_manifest_catalog_descriptors.sql`
- Modify: `apps/core/drizzle/meta/_journal.json` (append idx 47), `apps/core/src/db/schema/origin-manifests.ts:11` (after `originEntries`), `apps/core/src/test-utils/db.ts:295-335` (`seedOriginManifest`)
- Test: Create `apps/core/src/db/__tests__/migration-0047-catalog-descriptors.test.ts`

**Interfaces:** Produces `originManifests.brand / model / family` (`text`, nullable) and `originManifests.shortDescription` (`text('short_description')`); `seedOriginManifest(db, { …, brand?, model?, family?, shortDescription? })`, each `string | null`, default `null`.

- [ ] **Step 1: Branch, protocol dist, lane DB**

```bash
git -C /Users/samfleming/dev/hw/haiCore-v185 status --porcelain        # nothing
git -C /Users/samfleming/dev/hw/haiCore-v185 fetch origin && git -C /Users/samfleming/dev/hw/haiCore-v185 checkout -b v1.85-catalog-descriptors origin/main
cd /Users/samfleming/dev/hw/haiCore-v185 && npm run build:protocol
echo "exit=$?"
grep -n '^DATABASE_URL=' /Users/samfleming/dev/hw/haiCore-v185/.env    # names haiwave_v185_test
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run db:apply -- status    # 0000…0046 applied, nothing pending (else `-- migrate` first)
```

- [ ] **Step 2: Failing test** (controller: all four counters released before this step)

```ts
// apps/core/src/db/__tests__/migration-0047-catalog-descriptors.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase, endTestDatabase, seedParticipant, seedOriginManifest } from '../../test-utils/db.js';
import { originManifests, participants } from '../schema/index.js';
import type { Database } from '../index.js';

// v1.85 (2026-09-03), D-207 — migration 0047: brand / model / family /
// short_description on origin_manifests, nullable, no default, no backfill.
describe('migration 0047 catalog descriptors', () => {
  let db: Database;
  let participantId: string;
  beforeAll(async () => {
    db = await createTestDatabase();
    participantId = await seedParticipant(db, { legalName: `Descriptors Co ${Date.now()}` });
  });
  afterAll(async () => {
    await db.delete(originManifests).where(eq(originManifests.participantId, participantId));
    await db.delete(participants).where(eq(participants.id, participantId));
    await endTestDatabase();
  });

  it('stores and reads the four; null when not given', async () => {
    const withAll = await seedOriginManifest(db, {
      participantId, externalProductId: 'M47-A', productName: 'Widget', entries: [],
      brand: 'Acme', model: 'W-100', family: 'Widgets', shortDescription: 'A small widget.',
    });
    const [a] = await db.select().from(originManifests).where(eq(originManifests.id, withAll));
    expect(a).toMatchObject({ brand: 'Acme', model: 'W-100', family: 'Widgets', shortDescription: 'A small widget.' });
    const without = await seedOriginManifest(db, { participantId, externalProductId: 'M47-B', productName: 'Plain', entries: [] });
    const [b] = await db.select().from(originManifests).where(eq(originManifests.id, without));
    expect(b).toMatchObject({ brand: null, model: null, family: null, shortDescription: null });
  });
});
```

- [ ] **Step 3: Red**

Run: `cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && TEST_DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/db/__tests__/migration-0047-catalog-descriptors.test.ts --maxWorkers=3 --minWorkers=1`
Expected: FAIL — the row has no `brand` key (drizzle ignores the unknown insert key). A connection error or `haiwave_test` in the output means the prefix is wrong: stop.

- [ ] **Step 4: Green**

```sql
-- apps/core/drizzle/0047_origin_manifest_catalog_descriptors.sql
-- 0047_origin_manifest_catalog_descriptors.sql
-- v1.85 (2026-09-03), D-207. Vendor-declared catalog descriptors ride the origin
-- manifest: brand, model, family (the vendor's product line), short description.
-- Nullable, no default, no backfill — every version is a full statement and
-- stores exactly what the agent sent. No index: the latest-version lookup runs
-- on (participant_id, external_product_id, manifest_version).
ALTER TABLE origin_manifests
  ADD COLUMN brand text NULL,
  ADD COLUMN model text NULL,
  ADD COLUMN family text NULL,
  ADD COLUMN short_description text NULL;
```
`_journal.json` — append after the idx 46 object (`when` from `node -e 'console.log(Date.now())'`):
```json
    { "idx": 47, "version": "7", "when": <Date.now()>, "tag": "0047_origin_manifest_catalog_descriptors", "breakpoints": true }
```
`schema/origin-manifests.ts`, after `originEntries` (line 11; `text` is already imported):
```ts
  // v1.85 (2026-09-03), D-207: catalog descriptors, one full statement per version (null when none sent).
  brand: text('brand'),
  model: text('model'),
  family: text('family'),
  shortDescription: text('short_description'),
```
`test-utils/db.ts` `seedOriginManifest`: `opts` gains `brand?: string | null; model?: string | null; family?: string | null; shortDescription?: string | null;` and `.values({…})` gains `brand: opts.brand ?? null, model: opts.model ?? null, family: opts.family ?? null, shortDescription: opts.shortDescription ?? null,`.
```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run db:apply -- status && npm run db:apply -- migrate && npm run db:apply -- status   # 0047 pending → applied → nothing pending
```
Run the Step 3 command → PASS.

- [ ] **Step 5: Build, commit** (controller reports "0047 written + applied on haiwave_v185_test" to hw-db)

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/drizzle/0047_origin_manifest_catalog_descriptors.sql apps/core/drizzle/meta/_journal.json apps/core/src/db/schema/origin-manifests.ts apps/core/src/test-utils/db.ts apps/core/src/db/__tests__/migration-0047-catalog-descriptors.test.ts && git commit -m "feat(db): migration 0047 — catalog descriptors on origin_manifests (D-207)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 2: Protocol 3.81.0

**Files:**
- Modify: `packages/protocol/src/provenance/origin-manifest.ts` (`OriginManifestSchema` `:98-108`, `OriginManifestSubmitSchema` `:113-118` — both after `product_name`), `packages/protocol/src/audit/traversal.ts:258` (`AuditRunResultSchema`, after `product_id`), `packages/protocol/src/version.ts:852-853`, `packages/protocol/package.json` (`"version": "3.81.0"`; leave `package-lock.json` alone — its protocol entry still reads 3.79.0 after the 3.80.0 mint)
- Modify (the version pin, 18 sites in 17 files — the 3.80.0 mint did the same substitution, commit 581ffa00): `packages/protocol/src/__tests__/{evidence-scope-version,headers,version-3.80.0}.test.ts`, `src/audit/__tests__/{compliance-attributes,compliance-coverage,working-list}.test.ts`, `src/documents/__tests__/{po-extraction,quote-document}.test.ts`, `src/grounded-forecast/__tests__/schemas.test.ts`, `src/mcp/__tests__/get-order-status-output.test.ts`, `src/quotes/__tests__/{convert-po-commitment,fulfilment,offer,suggested-alternative-optional}.test.ts`, `src/search/__tests__/search.test.ts`, `src/watcher/__tests__/{order-promise-schedule,supplier-alias}.test.ts`
- Test: Create `packages/protocol/src/__tests__/catalog-descriptors-3.81.0.test.ts`

**Interfaces:** `OriginManifestSubmit` / `OriginManifest` gain `brand?`, `model?`, `family?`, `short_description?` (`string | null`); `AuditRunResult` gains `product_name?` plus the same four; `PROTOCOL_VERSION === '3.81.0'`; `OriginManifestSummarySchema` unchanged.

- [ ] **Step 1: Failing test**

```ts
// packages/protocol/src/__tests__/catalog-descriptors-3.81.0.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROTOCOL_VERSION } from '../version.js';
import { OriginManifestSubmitSchema, OriginManifestSchema } from '../provenance/origin-manifest.js';
import { AuditRunResultSchema } from '../audit/traversal.js';

const uuid = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;
const entry = { entry_id: uuid('01'), entry_type: 'primary_manufacture', facility: { facility_id: 'F1', country_code: 'US', facility_type: 'fabrication' }, provenance_depth: 'facility', subcomponent_origins: [] };
const submit = { external_product_id: 'SKU-1', product_name: 'Widget', domestic_context: 'US', origin_entries: [entry] };
const read = { ...submit, origin_manifest_id: uuid('02'), participant_id: uuid('03'), manifest_version: 1, created_at: '2026-09-03T00:00:00.000Z', updated_at: '2026-09-03T00:00:00.000Z' };
// tree.payload.product_id is z.string().uuid(); the row-level product_id is a plain string.
const row = {
  result_id: uuid('10'), run_id: uuid('11'), vendor_participant_id: uuid('12'), product_id: 'SKU-1', geo_rollup: [],
  tree: { participant_id: uuid('12'), depth_level: 1, components: [], gap: null, synthesis_mode: 'direct',
    payload: { kind: 'audit', product_id: uuid('13'), disclosure_data: null, class_ids: [],
      origin: { country_of_origin: 'US', state_province: null, city: null, plant_address: null, plant_identifier: null, vendor_name: null },
      operational_status: { lead_time_meets: null, capacity: null, delivery_state: null } } },
};
const four = { brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget.' };
const fourNull = { brand: null, model: null, family: null, short_description: null };

// v1.85 (2026-09-03), D-207 — 3.81.0: catalog descriptors on the manifest and result wire.
describe('protocol 3.81.0 — catalog descriptors', () => {
  it('is the current version and the changelog names the additions', () => {
    expect(PROTOCOL_VERSION).toBe('3.81.0');
    const src = readFileSync(resolve(__dirname, '../version.ts'), 'utf8');
    const changelog = src.slice(src.indexOf('// 3.81.0 ('));
    for (const s of ['D-207', 'OriginManifestSubmitSchema', 'AuditRunResultSchema', 'short_description', 'product_name', 'DEFERRED to 3.82.0', 'Next free: 3.82.0']) {
      expect(changelog, `changelog must contain ${s}`).toContain(s);
    }
  });
  it('manifest submit + read carry the four (absent → undefined, null → null); caps 255 / 500', () => {
    expect(OriginManifestSubmitSchema.parse({ ...submit, ...four })).toMatchObject(four);
    expect(OriginManifestSubmitSchema.parse(submit).brand).toBeUndefined();
    expect(OriginManifestSubmitSchema.parse({ ...submit, ...fourNull })).toMatchObject(fourNull);
    expect(OriginManifestSchema.parse({ ...read, ...four })).toMatchObject(four);
    expect(OriginManifestSubmitSchema.safeParse({ ...submit, brand: 'x'.repeat(256) }).success).toBe(false);
    expect(OriginManifestSubmitSchema.safeParse({ ...submit, short_description: 'x'.repeat(501) }).success).toBe(false);
  });
  it('result rows carry product_name + the four (absent → undefined, null → null); caps 255 / 500', () => {
    expect(AuditRunResultSchema.parse({ ...row, product_name: 'Widget', ...four })).toMatchObject({ product_name: 'Widget', ...four });
    expect(AuditRunResultSchema.parse(row).product_name).toBeUndefined();
    expect(AuditRunResultSchema.parse({ ...row, product_name: null, ...fourNull })).toMatchObject({ product_name: null, ...fourNull });
    expect(AuditRunResultSchema.safeParse({ ...row, product_name: 'x'.repeat(256) }).success).toBe(false);
    expect(AuditRunResultSchema.safeParse({ ...row, short_description: 'x'.repeat(501) }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Red**

Run: `cd /Users/samfleming/dev/hw/haiCore-v185/packages/protocol && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/__tests__/catalog-descriptors-3.81.0.test.ts --maxWorkers=3 --minWorkers=1`
Expected: all three FAIL — version is `3.80.0`; `toMatchObject(four)` finds no `brand` (zod strips unknown keys); the over-cap `safeParse` calls return `success: true`.

- [ ] **Step 3: Green** (controller has hw-db's 3.81.0 release + §P → 3.82.0 confirmation)

Both manifest schemas, after `product_name`:
```ts
  // v1.85 (2026-09-03), D-207 (3.81.0): vendor-declared catalog descriptors; family is the
  // product line. Every version is a full statement (null when none); optional so a 3.80.0
  // peer still parses. Caps mirror product_name (255) and subcomponent_description (500).
  brand: z.string().max(255).nullable().optional(),
  model: z.string().max(255).nullable().optional(),
  family: z.string().max(255).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
```
`AuditRunResultSchema`, after `product_id`:
```ts
  // v1.85 (2026-09-03), D-207 (3.81.0): the vendor's LATEST manifest name + descriptors, read at
  // results time, never persisted on the row; null when withheld or without a manifest;
  // optional so a 3.80.0 Central's rows still parse.
  product_name: z.string().max(255).nullable().optional(),
  brand: z.string().max(255).nullable().optional(),
  model: z.string().max(255).nullable().optional(),
  family: z.string().max(255).nullable().optional(),
  short_description: z.string().max(500).nullable().optional(),
```
`version.ts` — replace lines 852-853 (`// Next free: 3.81.0.` and the `PROTOCOL_VERSION` export) with:
```ts
// 3.81.0 (2026-09-03, v1.85 PR 3 — D-207 vendor catalog descriptors on the origin
// manifest): ADDITIVE. (a) OriginManifestSubmitSchema + OriginManifestSchema gain brand,
// model, family (max 255) and short_description (max 500), nullable + optional; a version
// stores exactly what was sent; OriginManifestSummarySchema unchanged. (b) AuditRunResultSchema
// gains product_name (max 255) plus the same four, nullable + optional, read from the vendor's
// latest manifest at results time. The §P docket parked at 3.80.0 is DEFERRED to 3.82.0, none
// carried (agent1, 2026-09-03).
// Next free: 3.82.0.
export const PROTOCOL_VERSION = '3.81.0';
```
`package.json`: `"version": "3.81.0"`. The version pin, all 18 sites at once (BSD sed):
```bash
cd /Users/samfleming/dev/hw/haiCore-v185/packages/protocol && grep -rl "toBe('3.80.0')" src | xargs sed -i '' "s/toBe('3.80.0')/toBe('3.81.0')/" && grep -rn "toBe('3.80.0')" src | wc -l    # 0
```
(`version-3.80.0.test.ts`'s second `it` still passes: its slice from `// 3.80.0 (` runs to end of file and keeps `DEFERRED to 3.81.0`.)

- [ ] **Step 4: Green suite, rebuild dist, commit** (controller reports "3.81.0 written" to hw-db)

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/packages/protocol && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 --minWorkers=1    # all PASS incl. version-metadata (package.json == PROTOCOL_VERSION)
cd /Users/samfleming/dev/hw/haiCore-v185 && npm run build:protocol
echo "exit=$?"
node -e 'console.log(require("/Users/samfleming/dev/hw/haiCore-v185/packages/protocol/dist/index.js").PROTOCOL_VERSION)'    # 3.81.0
cd /Users/samfleming/dev/hw/haiCore-v185 && git add packages/protocol/src packages/protocol/package.json && git commit -m "feat(protocol): 3.81.0 — catalog descriptors on the origin manifest and audit result rows (D-207)" -m "brand/model/family (255) + short_description (500) on the manifest schemas; product_name + the four on AuditRunResultSchema; all nullable + optional. Version pins moved to 3.81.0; §P docket deferred to 3.82.0." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 3: Publish stores the four on every new version; every manifest read returns them

**Files:**
- Modify: `apps/core/src/services/origin-manifest-service.ts:60-67` (insert `.values`), `:462-474` (`mapRow`)
- Test: Create `apps/core/src/services/__tests__/origin-manifest-descriptors.test.ts`

**Interfaces:** `createOrUpdateManifest`, `getManifest`, `getManifestByVersion` return the four (`null` when the version has none). The list / grouped / by-class / search views return summaries and are unchanged (spec §3).

- [ ] **Step 1: Failing test**

```ts
// apps/core/src/services/__tests__/origin-manifest-descriptors.test.ts
import { describe, it, expect, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { OriginManifestService } from '../origin-manifest-service.js';
import type { IAuditService } from '../audit-service.js';
import { createTestDatabase, endTestDatabase, seedParticipant } from '../../test-utils/db.js';
import { originManifests, participants } from '../../db/schema/index.js';

const noopAudit = { logEvent: vi.fn().mockResolvedValue(undefined), queryEvents: vi.fn() } as unknown as IAuditService;
const entry = {
  entry_id: '00000000-0000-4000-8000-000000000001', entry_type: 'primary_manufacture' as const,
  facility: { facility_id: 'F1', country_code: 'US', facility_type: 'fabrication' as const, verified: false, verification_method: 'self_declared' as const },
  provenance_depth: 'facility' as const, subcomponent_origins: [],
};
const base = { external_product_id: 'DESC-1', product_name: 'Widget', domestic_context: 'US', origin_entries: [entry] };
const four = { brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget.' };
const fourNull = { brand: null, model: null, family: null, short_description: null };

// v1.85 (2026-09-03), D-207: a version stores exactly what was sent; history stays intact.
describe('OriginManifestService catalog descriptors', () => {
  const seeded: string[] = [];
  afterAll(async () => {
    const db = await createTestDatabase();
    for (const p of seeded) {
      await db.delete(originManifests).where(eq(originManifests.participantId, p));
      await db.delete(participants).where(eq(participants.id, p));
    }
    await endTestDatabase();
  });

  it('stores the four on v1, returns them on every read; a later publish without them stores nulls on v2, v1 intact', async () => {
    const db = await createTestDatabase();
    const svc = new OriginManifestService(db, noopAudit);
    const p = await seedParticipant(db, { legalName: `DESC-${Date.now()}` });
    seeded.push(p);
    expect(await svc.createOrUpdateManifest(p, { ...base, ...four })).toMatchObject({ manifest_version: 1, ...four });
    expect(await svc.getManifest(p, 'DESC-1')).toMatchObject(four);
    expect(await svc.createOrUpdateManifest(p, base)).toMatchObject({ manifest_version: 2, ...fourNull });
    expect(await svc.getManifest(p, 'DESC-1')).toMatchObject({ manifest_version: 2, ...fourNull });
    expect(await svc.getManifestByVersion(p, 'DESC-1', 1)).toMatchObject({ manifest_version: 1, ...four });
  });
});
```

- [ ] **Step 2: Red**

Run: `cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && TEST_DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/services/__tests__/origin-manifest-descriptors.test.ts --maxWorkers=3 --minWorkers=1`
Expected: FAIL at the first `toMatchObject` — the returned manifest has no `brand` key.

- [ ] **Step 3: Green**

`.values({…})` (lines 60-67), after `originEntries: data.origin_entries,`:
```ts
          // v1.85 (2026-09-03), D-207: exactly what was sent; absent → null.
          brand: data.brand ?? null,
          model: data.model ?? null,
          family: data.family ?? null,
          shortDescription: data.short_description ?? null,
```
`mapRow` (lines 462-474), after `origin_entries: …,`:
```ts
      brand: row.brand ?? null,
      model: row.model ?? null,
      family: row.family ?? null,
      short_description: row.shortDescription ?? null,
```

- [ ] **Step 4: Green, build, commit**

Run the Step 2 command → PASS. Then:
```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/services/origin-manifest-service.ts apps/core/src/services/__tests__/origin-manifest-descriptors.test.ts && git commit -m "feat(provenance): store and return catalog descriptors on every manifest version (D-207)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 4: Counterparty catalog carries the latest version's descriptors

**Files:**
- Modify: `apps/core/src/services/catalog-service.ts:12-16` (`CatalogProduct`), `:104-132` (`listProducts` query + map). `routes/participant-catalog.ts` needs no change (it sends the service result); the route test pins the wire.
- Test: Modify `apps/core/src/services/__tests__/catalog-service.test.ts` (append one `it` to `CatalogService.listProducts`), `apps/core/src/routes/__tests__/participant-catalog.test.ts` (append one `it` to the `catalog-products` describe; add `seedOriginManifest` to the test-utils import and `originManifests` to the schema import; add `await db.delete(originManifests).where(eq(originManifests.participantId, vendorId));` as the FIRST line of `cleanup` — the FK to participants requires it)

**Interfaces:** `CatalogProduct` = `{ external_product_id, product_name, primary_class_slug, brand, model, family, short_description }`, descriptors `string | null` — the shape HaiWeb's mirror copies.

- [ ] **Step 1: Failing tests**

`catalog-service.test.ts` (imports already cover `sql`, `seedOriginManifest`):
```ts
  // v1.85 (2026-09-03), D-207: the latest version's descriptors ride the row.
  it('carries brand / model / family / short_description from the LATEST manifest; null when none', async () => {
    const db = await createTestDatabase();
    const service = new CatalogService(db);
    const vendor = await seedParticipant(db, { legalName: 'V-desc' });
    await seedNetworkIndex(db, vendor, [{ productId: 'DESC-1', classIds: ['cat-a'] }, { productId: 'NONE-1', classIds: ['cat-a'] }]);
    await seedOriginManifest(db, { participantId: vendor, externalProductId: 'DESC-1', productName: 'Old', entries: [], brand: 'Old Brand', model: 'OLD-1', family: 'Old Line', shortDescription: 'old' });
    await db.execute(sql`
      INSERT INTO origin_manifests (participant_id, external_product_id, product_name, manifest_version, domestic_context, origin_entries, brand, model, family, short_description)
      VALUES (${vendor}, 'DESC-1', 'Widget', 2, 'US', '[]'::jsonb, 'Acme', 'W-100', 'Widgets', 'A small widget.')
    `);
    const byId = Object.fromEntries((await service.listProducts(vendor, null, 1, 50)).products.map((p) => [p.external_product_id, p]));
    expect(byId['DESC-1']).toMatchObject({ product_name: 'Widget', brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget.' });
    expect(byId['NONE-1']).toMatchObject({ product_name: null, brand: null, model: null, family: null, short_description: null });
  });
```
`participant-catalog.test.ts`:
```ts
  // v1.85 (2026-09-03), D-207: the wire carries the four, null when absent.
  it('→ 200 rows carry brand / model / family / short_description (null when the product has none)', async () => {
    await seedTradingRelationship(db, { participantA: auditorId, participantB: vendorId });
    await seedNetworkIndex(db, vendorId, [{ productId: `PD1-${vendorId}`, classIds: ['pc-prod-a'] }, { productId: `PD2-${vendorId}`, classIds: ['pc-prod-a'] }]);
    await seedOriginManifest(db, { participantId: vendorId, externalProductId: `PD1-${vendorId}`, productName: 'Widget', entries: [], brand: 'Acme', model: 'W-100', family: 'Widgets', shortDescription: 'A small widget.' });
    const app = await buildApp(auditorId);
    const res = await app.inject({ method: 'GET', url: `/api/v1/participants/${vendorId}/catalog-products` });
    expect(res.statusCode).toBe(200);
    const byId = Object.fromEntries((res.json().products as Array<Record<string, unknown>>).map((p) => [p.external_product_id, p]));
    expect(byId[`PD1-${vendorId}`]).toEqual({ external_product_id: `PD1-${vendorId}`, product_name: 'Widget', primary_class_slug: 'pc-prod-a', brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget.' });
    expect(byId[`PD2-${vendorId}`]).toEqual({ external_product_id: `PD2-${vendorId}`, product_name: null, primary_class_slug: 'pc-prod-a', brand: null, model: null, family: null, short_description: null });
    await app.close();
    await cleanup(auditorId, vendorId);
  });
```

- [ ] **Step 2: Red**

Run: `cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && TEST_DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/services/__tests__/catalog-service.test.ts src/routes/__tests__/participant-catalog.test.ts --maxWorkers=3 --minWorkers=1`
Expected: the two new tests FAIL (no `brand` key; the 7-key `toEqual` against a 3-key row); existing tests green.

- [ ] **Step 3: Green**

`CatalogProduct` gains, after `primary_class_slug`:
```ts
  // v1.85 (2026-09-03), D-207: the latest manifest's descriptors; null without a manifest or when the vendor sent none.
  brand: string | null;
  model: string | null;
  family: string | null;
  short_description: string | null;
```
`listProducts`: the outer SELECT gains `om.brand AS brand, om.model AS model, om.family AS family, om.short_description AS short_description` after `om.product_name AS product_name`; the lateral `SELECT om.product_name` becomes `SELECT om.product_name, om.brand, om.model, om.family, om.short_description`; the row type gains the four as `string | null`; the map gains `brand: r.brand ?? null, model: r.model ?? null, family: r.family ?? null, short_description: r.short_description ?? null`.

- [ ] **Step 4: Green, build, commit**

Run the Step 2 command → PASS. Then:
```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/services/catalog-service.ts apps/core/src/services/__tests__/catalog-service.test.ts apps/core/src/routes/__tests__/participant-catalog.test.ts && git commit -m "feat(catalog): counterparty catalog rows carry the latest manifest's descriptors (D-207)" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 5: Audit results carry the vendor's latest name + descriptors

**Files:**
- Modify: `apps/core/src/services/audit-run-service.ts:4` (import `originManifests`), `:736-751` (`getResults`), `:1066-1076` (`mapResultRow`)
- Test: Create `apps/core/src/services/__tests__/audit-run-results-descriptors.test.ts`; Modify `apps/core/src/routes/__tests__/audit-runs.test.ts` (append one `describe` at the end; reuses its `buildApp`, `cleanupAll`, `db`, and the already-imported `seedOriginManifest`, `auditRuns`, `auditRunResults`)

**Interfaces:** `getResults` rows carry `product_name` + the four; `null` on a withheld row (null vendor / product) or without a manifest. `mapResultRow` is the only `AuditRunResult` emitter in the service; `audit-report-service.ts` (the other `getResults` caller) projects to its own five fields and is unaffected.

- [ ] **Step 1: Failing tests** (both — service and route — go red together)

```ts
// apps/core/src/services/__tests__/audit-run-results-descriptors.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { AuditRunService } from '../audit-run-service.js';
import { AuditScopeService } from '../audit-scope-service.js';
import { AuditService } from '../audit-service.js';
import { SkuObligationService } from '../sku-obligation-service.js';
import type { ITrustBypassService } from '../trust-bypass-service.js';
import type { UnifiedMultiHopOrchestrator } from '../unified-multi-hop-orchestrator.js';
import type { Database } from '../../db/index.js';
import { auditRuns, auditRunResults, originManifests, participants } from '../../db/schema/index.js';
import { createTestDatabase, endTestDatabase, seedParticipant, seedOriginManifest } from '../../test-utils/db.js';

// v1.85 (2026-09-03), D-207: results carry the vendor's LATEST manifest name + descriptors,
// read at results time; null without a manifest, without descriptors, or on a withheld row.
const tree = (participantId: string | null, productId: string | null) => ({
  participant_id: participantId, depth_level: 1, components: [], gap: null, synthesis_mode: 'direct',
  payload: { kind: 'audit', product_id: productId, disclosure_data: null, class_ids: [],
    origin: { country_of_origin: 'US', state_province: null, city: null, plant_address: null, plant_identifier: null, vendor_name: null },
    operational_status: { lead_time_meets: null, capacity: null, delivery_state: null } },
});
const four = { brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget.' };
const fiveNull = { product_name: null, brand: null, model: null, family: null, short_description: null };

describe('AuditRunService.getResults catalog descriptors', () => {
  let db: Database;
  let service: AuditRunService;
  let auditor: string; let vendorWith: string; let vendorWithout: string; let runId: string;

  beforeAll(async () => {
    db = await createTestDatabase();
    const audit = new AuditService(db);
    const scopes = new AuditScopeService(db);
    scopes.setAudit(audit);
    service = new AuditRunService(db, {} as unknown as UnifiedMultiHopOrchestrator, scopes,
      new SkuObligationService(db, audit, {} as unknown as ITrustBypassService), audit);
    auditor = await seedParticipant(db, { legalName: `RD-A-${Date.now()}` });
    vendorWith = await seedParticipant(db, { legalName: `RD-V1-${Date.now()}` });
    vendorWithout = await seedParticipant(db, { legalName: `RD-V2-${Date.now()}` });
    await seedOriginManifest(db, { participantId: vendorWith, externalProductId: 'RD-1', productName: 'Old', entries: [], brand: 'Old Brand' });
    await db.execute(sql`INSERT INTO origin_manifests (participant_id, external_product_id, product_name, manifest_version, domestic_context, origin_entries, brand, model, family, short_description)
      VALUES (${vendorWith}, 'RD-1', 'Widget', 2, 'US', '[]'::jsonb, 'Acme', 'W-100', 'Widgets', 'A small widget.')`);
    await seedOriginManifest(db, { participantId: vendorWith, externalProductId: 'RD-2', productName: 'Plain', entries: [] });
    const [run] = await db.insert(auditRuns).values({ initiatorParticipantId: auditor, scopeSnapshot: { scope_ids: [], resolved_products: [] }, status: 'complete', depthLimit: 5 }).returning({ runId: auditRuns.runId });
    runId = run.runId;
    await db.insert(auditRunResults).values([
      { runId, vendorParticipantId: vendorWith, productId: 'RD-1', tree: tree(vendorWith, 'RD-1'), geoRollup: [] },
      { runId, vendorParticipantId: vendorWith, productId: 'RD-2', tree: tree(vendorWith, 'RD-2'), geoRollup: [] },
      { runId, vendorParticipantId: vendorWithout, productId: 'RD-3', tree: tree(vendorWithout, 'RD-3'), geoRollup: [] },
      { runId, vendorParticipantId: null, productId: null, tree: tree(null, null), geoRollup: [] }, // withheld (v.1.42)
    ]);
  });
  afterAll(async () => {
    await db.delete(auditRunResults).where(eq(auditRunResults.runId, runId));
    await db.delete(auditRuns).where(eq(auditRuns.runId, runId));
    await db.delete(originManifests).where(eq(originManifests.participantId, vendorWith));
    for (const p of [auditor, vendorWith, vendorWithout]) await db.delete(participants).where(eq(participants.id, p));
    await endTestDatabase();
  });

  it('latest manifest name + descriptors; nulls without a manifest, without descriptors, on a withheld row; filters still work', async () => {
    const results = await service.getResults(runId, auditor);
    expect(results).toHaveLength(4);
    const byProduct = new Map(results.map((r) => [r.product_id, r]));
    expect(byProduct.get('RD-1')).toMatchObject({ product_name: 'Widget', ...four });
    expect(byProduct.get('RD-2')).toMatchObject({ product_name: 'Plain', brand: null, model: null, family: null, short_description: null });
    expect(byProduct.get('RD-3')).toMatchObject(fiveNull);
    expect(results.find((r) => r.vendor_participant_id === null)).toMatchObject({ product_id: null, ...fiveNull });
    const one = await service.getResults(runId, auditor, { vendorId: vendorWith, productId: 'RD-1' });
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ product_id: 'RD-1', brand: 'Acme' });
  });
});
```
Append to `audit-runs.test.ts`:
```ts
// v1.85 (2026-09-03), D-207: the results wire carries name + descriptors, null when absent.
describe('audit-runs routes — GET /api/v1/source-audit/runs/:id/results catalog descriptors', () => {
  it('→ 200 rows carry product_name + the four (null when the product has no manifest)', async () => {
    const auditorId = await seedParticipant(db, { legalName: `RR-A-${Date.now()}` });
    const vendorId = await seedParticipant(db, { legalName: `RR-V-${Date.now()}` });
    await seedOriginManifest(db, { participantId: vendorId, externalProductId: 'RR-1', productName: 'Widget', entries: [], brand: 'Acme', model: 'W-100', family: 'Widgets', shortDescription: 'A small widget.' });
    const [run] = await db.insert(auditRuns).values({ initiatorParticipantId: auditorId, scopeSnapshot: { scope_ids: [], resolved_products: [] }, status: 'complete', depthLimit: 5 }).returning({ runId: auditRuns.runId });
    const leaf = (productId: string) => ({ participant_id: vendorId, depth_level: 1, components: [], gap: null, synthesis_mode: 'direct',
      payload: { kind: 'audit', product_id: productId, disclosure_data: null, class_ids: [],
        origin: { country_of_origin: 'US', state_province: null, city: null, plant_address: null, plant_identifier: null, vendor_name: null },
        operational_status: { lead_time_meets: null, capacity: null, delivery_state: null } } });
    await db.insert(auditRunResults).values([
      { runId: run.runId, vendorParticipantId: vendorId, productId: 'RR-1', tree: leaf('RR-1'), geoRollup: [] },
      { runId: run.runId, vendorParticipantId: vendorId, productId: 'RR-2', tree: leaf('RR-2'), geoRollup: [] },
    ]);
    const { app } = await buildApp(auditorId);
    const res = await app.inject({ method: 'GET', url: `/api/v1/source-audit/runs/${run.runId}/results` });
    expect(res.statusCode).toBe(200);
    const byProduct = Object.fromEntries((res.json().results as Array<Record<string, unknown>>).map((r) => [r.product_id, r]));
    expect(byProduct['RR-1']).toMatchObject({ product_name: 'Widget', brand: 'Acme', model: 'W-100', family: 'Widgets', short_description: 'A small widget.' });
    expect(byProduct['RR-2']).toMatchObject({ product_name: null, brand: null, model: null, family: null, short_description: null });
    await app.close();
    await cleanupAll([auditorId, vendorId]);
  });
});
```

- [ ] **Step 2: Red**

Run: `cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && TEST_DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/services/__tests__/audit-run-results-descriptors.test.ts src/routes/__tests__/audit-runs.test.ts --maxWorkers=3 --minWorkers=1`
Expected: the two new tests FAIL on the first `toMatchObject` (no `product_name` key); every existing `audit-runs.test.ts` test stays green.

- [ ] **Step 3: Green**

Line 4: `import { auditRuns, auditRunResults, runTemplates, originManifests } from '../db/schema/index.js';`

`getResults` (lines 736-751) becomes:
```ts
  async getResults(
    runId: string,
    auditorId: string,
    filter: { vendorId?: string; productId?: string } = {},
  ): Promise<AuditRunResult[]> {
    const run = await this.getById(runId, auditorId);
    if (!run) return [];
    const conds: SQL[] = [eq(auditRunResults.runId, runId)];
    if (filter.vendorId) conds.push(eq(auditRunResults.vendorParticipantId, filter.vendorId));
    if (filter.productId) conds.push(eq(auditRunResults.productId, filter.productId));
    // v1.85 (2026-09-03), D-207: the vendor's LATEST manifest, read at results time and never
    // persisted on the row. A withheld row (null vendor / product) joins nothing.
    const latestManifest = this.db
      .select({
        productName: originManifests.productName,
        brand: originManifests.brand,
        model: originManifests.model,
        family: originManifests.family,
        shortDescription: originManifests.shortDescription,
      })
      .from(originManifests)
      .where(and(
        eq(originManifests.participantId, auditRunResults.vendorParticipantId),
        eq(originManifests.externalProductId, auditRunResults.productId),
      ))
      .orderBy(desc(originManifests.manifestVersion))
      .limit(1)
      .as('latest_manifest');
    const rows = await this.db
      .select({
        result: auditRunResults,
        productName: latestManifest.productName,
        brand: latestManifest.brand,
        model: latestManifest.model,
        family: latestManifest.family,
        shortDescription: latestManifest.shortDescription,
      })
      .from(auditRunResults)
      .leftJoinLateral(latestManifest, sql`true`)
      .where(and(...conds));
    return rows.map((r) => mapResultRow(r.result, {
      product_name: r.productName ?? null,
      brand: r.brand ?? null,
      model: r.model ?? null,
      family: r.family ?? null,
      short_description: r.shortDescription ?? null,
    }));
  }
```
`mapResultRow` (lines 1066-1076) becomes:
```ts
// v1.85 (2026-09-03), D-207: name + descriptors from the vendor's latest manifest, supplied by the caller's join.
interface ResultDescriptors {
  product_name: string | null;
  brand: string | null;
  model: string | null;
  family: string | null;
  short_description: string | null;
}

function mapResultRow(r: typeof auditRunResults.$inferSelect, d: ResultDescriptors): AuditRunResult {
  return {
    result_id: r.resultId,
    run_id: r.runId,
    vendor_participant_id: r.vendorParticipantId,
    product_id: r.productId,
    tree: r.tree as ObservationNode,
    geo_rollup: r.geoRollup as GeoRollupEntry[],
    install_compliance_status: r.installComplianceStatus ?? null,
    product_name: d.product_name,
    brand: d.brand,
    model: d.model,
    family: d.family,
    short_description: d.short_description,
  };
}
```

- [ ] **Step 4: Green; the other getResults suites; build; commit**

Run the Step 2 command → PASS. Then:
```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && TEST_DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run src/services/__tests__/audit-run-service.test.ts src/services/__tests__/audit-run-service-async.test.ts src/services/__tests__/audit-report-service.test.ts src/services/__tests__/lead-time-gofish-integration.test.ts --maxWorkers=3 --minWorkers=1    # PASS
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/services/audit-run-service.ts apps/core/src/services/__tests__/audit-run-results-descriptors.test.ts apps/core/src/routes/__tests__/audit-runs.test.ts && git commit -m "feat(audit): results carry the vendor's latest manifest name + catalog descriptors (D-207)" -m "leftJoinLateral to the latest origin_manifests row per (vendor, product); null on a withheld row or without a manifest. Result hash projection unchanged." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 6: D-207 register row and v1.53 revision row

**Files:** Modify `docs/security/security-compliance.md` — D-207 row directly AFTER the D-206 row (line 335, last of §4.3); v1.53 row directly AFTER `|---|---|---|` at line 414 (the §7 table is newest-first). Docs: no test; cites verified by grep before the commit; no unescaped `|` in either row.

- [ ] **Step 1: Write the rows** (the controller confirms its own id via `ListAgents` before writing "authored by"; hw-db's D-207 / v1.53 release is already in hand)

```
| **D-207** | **Vendor-declared catalog descriptors — brand, model, family, short description — ride the vendor's own origin manifest and are served only through doors that already disclose the same product to the same caller.** Protocol 3.81.0 (`packages/protocol/src/provenance/origin-manifest.ts`) adds four optional, nullable fields (255 / 255 / 255 / 500) to `OriginManifestSubmitSchema` / `OriginManifestSchema`; migration 0047 adds the four nullable columns to `origin_manifests`; `OriginManifestService.createOrUpdateManifest` stores exactly what the agent sent on each new version (a later version without them stores nulls; history intact). Read sites, both from the vendor's LATEST manifest at read time: the counterparty catalog (`CatalogService.listProducts`, `GET /api/v1/participants/:vendor_id/catalog-products` — `catalog:query` scope plus an active trading relationship or provenance-key installation, unchanged) and audit-run results (`AuditRunService.getResults`, `GET /api/v1/source-audit/runs/:id/results` — the auditor's own run, which already returns the vendor's product ids; `AuditRunResultSchema` gains `product_name` plus the four). A withheld result row (null vendor / product, v.1.42) joins nothing. No new endpoint, job, scope or classifier path; nothing inferred; `manufacturer_part_number` and `network_index.brand` / `family_id` stay unwritten; the audit result hash (`audit-result-hash.ts`) excludes the descriptors. | Owner (2026-09-03): the audit run page listed products "by bare SKU id — not even the product name"; ruled "ride the existing origin-manifest publish — we already have that mechanism", "family is the product line the vendor already has", "model is its own field", "publish + display now; search later". Disclosure: catalog-tier data the vendor chose to publish about its own product, shown only to a caller who already sees that product's id through the same door; no stock, quantity, price or origin data added; the counterparty disclosure ceiling (D-148) is unchanged. Trade-off accepted: a product with no manifest carries no descriptors (the product name's existing limit); descriptors are not audit evidence, so the hash excludes them — a later vendor edit changes what an old run DISPLAYS, not what it PINNED. A Central at 3.80.0 strips a 3.81.0 agent's fields under `PROTOCOL_STRICT_VALIDATION=warn` (default) and refuses them under `enforce`; haiCore ships first. Deferred (§L, spec §10): search over the fields; gather extraction; own-catalog / picker views; version-aware republish. | Built — haiCore v1.85 PR 3 (branch `v1.85-catalog-descriptors`; migration 0047; protocol 3.81.0; merge sha and deploy recorded here at deploy). haiClient and HaiWeb follow in their PRs. | 2026-09-03 |
```
```
| v1.53 | 2026-09-03 | **D-207 added (haiCore v1.85 PR 3, branch `v1.85-catalog-descriptors`; migration 0047; protocol 3.81.0):** vendor-declared brand, model, family and short description ride the origin manifest, stored per version exactly as sent, and are read from the latest version on the counterparty catalog and audit-run results through their existing doors; no new endpoint or scope; result hash unchanged. Numbers allocated by agent1 2026-09-03; row authored by hw-e6 on the branch, cites to be verified at merge. |
```

- [ ] **Step 2: Verify cites and shape, commit** (controller reports "D-207 + v1.53 written" to hw-db)

```bash
cd /Users/samfleming/dev/hw/haiCore-v185 && for f in packages/protocol/src/provenance/origin-manifest.ts apps/core/src/services/origin-manifest-service.ts apps/core/src/services/catalog-service.ts apps/core/src/services/audit-run-service.ts apps/core/src/services/audit-result-hash.ts apps/core/drizzle/0047_origin_manifest_catalog_descriptors.sql; do [ -f "$f" ] && echo "ok $f" || echo "MISSING $f"; done
cd /Users/samfleming/dev/hw/haiCore-v185 && grep -c "catalog-products" apps/core/src/routes/participant-catalog.ts && grep -c "/runs/:id/results" apps/core/src/routes/audit-runs.ts && grep -c "'3.81.0'" packages/protocol/src/version.ts && grep -c "PROTOCOL_STRICT_VALIDATION" apps/core/src/lib/strict-body.ts
cd /Users/samfleming/dev/hw/haiCore-v185 && grep -n -E "^\| \*\*D-20[67]\*\*|^\| v1\.5[23] \|" docs/security/security-compliance.md | cut -c1-30    # D-206 then D-207 adjacent; v1.53 above v1.52
cd /Users/samfleming/dev/hw/haiCore-v185 && awk -F'|' '/^\| \*\*D-207\*\*/{print NF-1} /^\| v1\.53 \|/{print NF-1}' docs/security/security-compliance.md    # 6 then 4
cd /Users/samfleming/dev/hw/haiCore-v185 && git add docs/security/security-compliance.md && git commit -m "docs(security): D-207 catalog descriptors on the origin manifest; revision v1.53" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg"
```

---

### Task 7: Binding gate on the merging tree; PR package — HOLD for the owner

Output: `/Users/samfleming/dev/hw/haiCore-v185/.superpowers/sdd/2026-09-03-catalog-descriptors-haicore/` (untracked — preserve before any worktree removal).

- [ ] **Step 1: Re-base check, builds, test typecheck**

```bash
git -C /Users/samfleming/dev/hw/haiCore-v185 fetch origin && git -C /Users/samfleming/dev/hw/haiCore-v185 log --oneline HEAD..origin/main    # non-empty → `git rebase origin/main`, re-run the touched tasks' single-file tests
git -C /Users/samfleming/dev/hw/haiCore-v185 status --porcelain    # nothing
cd /Users/samfleming/dev/hw/haiCore-v185 && npm run build
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run typecheck:tests    # "401 errors in N files (baseline 401)", exit 0 — one more fails the ratchet
echo "exit=$?"
mkdir -p /Users/samfleming/dev/hw/haiCore-v185/.superpowers/sdd/2026-09-03-catalog-descriptors-haicore
```

- [ ] **Step 2: Gates (controller announces to hw-db first; FOREGROUND; one at a time)**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/packages/protocol && /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 --minWorkers=1
echo "exit=$?"
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && TEST_DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test /Users/samfleming/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 --minWorkers=1 2>&1 | tee /Users/samfleming/dev/hw/haiCore-v185/.superpowers/sdd/2026-09-03-catalog-descriptors-haicore/gate-core.log; echo "pipe-exit=${pipestatus[1]}"
grep -c "(retry x" /Users/samfleming/dev/hw/haiCore-v185/.superpowers/sdd/2026-09-03-catalog-descriptors-haicore/gate-core.log    # 0
```
Expected: both exit 0, no failures, `(retry x` count 0. A red that passes alone is a flake to REPORT, not retry into green. Controller tells hw-db "gate done".

- [ ] **Step 3: PR body, HOLD**

`git -C /Users/samfleming/dev/hw/haiCore-v185 log --oneline origin/main..HEAD` → write `pr-body.md`: title `v1.85 PR 3 (haiCore) — catalog descriptors on the origin manifest (D-207, migration 0047, protocol 3.81.0)`; `## Summary` (one line per task); `## Test plan` (gate numbers, build + typecheck:tests exits, "0047 applied on haiwave_v185_test via db:apply status → migrate"); `## Deploy notes` ("apply 0047 to dev `haiwave` with `db:apply -- status` then `-- migrate`; **check prod's `origin_manifests` constraints before the prod migration** (0046 drift precedent); rebuild the primary protocol dist after merge (HaiWeb's symlink); the haiClient re-vendor + 1.86.0 are agent1's; 3.80.0 agents keep publishing — fields stripped under `warn`, refused under `enforce`"); `## §L` (audit-report-service projects the descriptors away — record if a report ever wants them); attribution lines `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and `https://claude.ai/code/session_014PrSmATYa2NoxBWrrq9oLg`.

Report branch, HEAD, commits, gate numbers, `pr-body.md` path. **Do not push, PR, merge, tag or deploy.** On the owner's word only: `git -C /Users/samfleming/dev/hw/haiCore-v185 push -u origin v1.85-catalog-descriptors` then `gh pr create --repo simmysam3/haiCore --base main --head v1.85-catalog-descriptors --title "…" --body-file …/pr-body.md`; report the PR URL to hw-db (the haiClient re-vendor waits on the merge).

---

## Self-review (author)

**Spec coverage.** §2 → Tasks 1, 3; §3 → Task 2 (both manifest schemas, `AuditRunResultSchema`, `version.ts`, summary schema untouched); §4.1 → Task 1 (status-then-migrate; prod-constraints note in Task 7); §4.2 → Task 3 (`mapRow` serves every full-manifest read: `createOrUpdateManifest`, `getManifest`, `getManifestByVersion`; the other four service methods return summaries); §4.3 → Task 4 (route unchanged, wire pinned); §4.4 → Task 5 (lateral join; `mapResultRow` is the only emitter; hash sites untouched); §4.5 → Task 6; §7 → Global Constraints + Task 7; §8 protocol + haiCore behaviours → Tasks 2–5, one `it` each where the spec lists one behaviour, combined where the spec lists a pair; §9 step 1 → Task 7 HOLD.

**Placeholders / cannot-fail assertions.** None; every `it` goes red at its stated step for the stated reason (the traversal fixture uses a UUID for `tree.payload.product_id`, so its caps checks fail only for the cap).

**Type consistency.** `originManifests.shortDescription` ↔ `short_description` across Tasks 1, 3 (drizzle), 4 (raw SQL) and 5 (drizzle); `seedOriginManifest` option names match every call; `mapResultRow(r, d)` has one caller, changed in the same step; wire names identical on submit, read, result, and in `CatalogProduct`; `SkuObligationService` is constructed with its three parameters so the test typecheck ratchet holds at 401.

**Counters.** All four released by hw-db before Task 1 Step 2, each first write reported.
