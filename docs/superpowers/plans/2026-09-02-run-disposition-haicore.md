# Run disposition on definition delete — haiCore + protocol Implementation Plan (v1.85 PR 2, part 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a Sonar definition (run template) is deleted, its prior runs are deleted, archived, or kept by the caller's choice; audits always archive; archived runs are hidden from every list and rollup by default and reachable through an `archived=true` filter; kept and archived runs keep the definition's name.

**Architecture:** One transactional `RunTemplateService.delete(participantId, templateId, { runs })` stamps `template_name_snapshot` and `archived_at` on the class's run table (or deletes the rows) before deleting the template row. `WatcherRunService.list` / `AuditRunService.list` and three secondary readers add `archived_at IS NULL` by default; the two list routes take `?archived=`. Protocol 3.80.0 adds `archived_at` to both run envelopes and the delete response schema. Migration 0046 adds the two columns to `watcher_runs` and `audit_runs` and relaxes the `watcher_snapshots.template_id` cascade to SET NULL.

**Tech Stack:** Node 26, TypeScript, Fastify, drizzle-orm (pg), hand-written SQL migrations under `apps/core/drizzle/`, zod protocol package `packages/protocol`, vitest (haiCore). Dev Postgres on :5433 via docker `infrastructure-postgres-1`.

**Spec:** `docs/superpowers/specs/2026-09-02-run-disposition-on-delete-design.md` (in the HaiWeb repo, branch `v1.85-run-disposition`). Read §2 (semantics) and §3 (haiCore) before any task.

## Global Constraints

- Work ONLY in the worktree `/Users/samfleming/dev/hw/haiCore-v185` (branch `v1.85-run-disposition`, cut from `origin/main`). Start every shell command with `cd /Users/samfleming/dev/hw/haiCore-v185 &&` (or the package dir under it). The primary `~/dev/hw/haiCore` is Central's RUNNING source tree — never edit, check out, or `npm install` there.
- Counters, allocated by agent1 and not to be changed: migration **0046**, protocol **3.80.0**, decision **D-206**, register **v1.52**. Message agent1 (session `hw-4b`) at the moment each is written into a file (the controller does this; executors report it).
- Protocol 3.80.0 CHANGELOG must DEFER every parked §P item to 3.81.0 by name (Task 2 has the exact text).
- Tests run against the LANE database `haiwave_v185_test` only: every vitest invocation is prefixed `DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test`. Never the shared `haiwave_test`, never `haiwave`.
- vitest flags: `--maxWorkers=3 --minWorkers=1` if the installed vitest accepts `--minWorkers` (haiCore's does; if it errors "Unknown option", drop `--minWorkers`). Run gates FOREGROUND. Never two haiCore gates at once on this machine.
- Copy style: comments dated `v1.85 (2026-09-02)`, one sentence of why, no marketing. Wire fields snake_case. No `any`.
- Audit rule is server-enforced (400 `AUDIT_RUNS_ARCHIVE_ONLY`), running runs block non-keep dispositions (409 `RUNS_IN_FLIGHT`). Default disposition for a watcher template when `runs` is absent: `keep`.
- Commit after every green task with a conventional message ending in the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Do not push until Task 10.

---

### Task 1: Lane setup, migration 0046, schema columns

**Files:**
- Create: `apps/core/drizzle/0046_run_archive_on_template_delete.sql`
- Modify: `apps/core/drizzle/meta/_journal.json` (append idx 46)
- Modify: `apps/core/src/db/schema/watcher-runs.ts` (add two columns + partial index)
- Modify: `apps/core/src/db/schema/audit-runs.ts` (add two columns + partial index)
- Modify: `apps/core/src/db/schema/watcher-snapshots.ts:17` (`onDelete: 'cascade'` → `'set null'`)
- Test: `apps/core/src/db/__tests__/migration-0046-run-archive.test.ts`

**Interfaces:**
- Produces: columns `watcherRuns.archivedAt` (`timestamp with time zone`, nullable), `watcherRuns.templateNameSnapshot` (`text`, nullable), and the same two on `auditRuns`. Later tasks import them from `../db/schema/index.js`.

- [ ] **Step 1: Lane worktree and lane database (setup that this task's deliverable needs)**

```bash
git -C haiCore fetch origin && git -C haiCore worktree add /Users/samfleming/dev/hw/haiCore-v185 -b v1.85-run-disposition origin/main
# node_modules: APFS-clone from a sibling whose package-lock.json sha1 is IDENTICAL to the new worktree's (check both with shasum -a 1); never npm install.
shasum -a 1 /Users/samfleming/dev/hw/haiCore-v185/package-lock.json /Users/samfleming/dev/hw/haiCore-mv184/package-lock.json
cp -Rc /Users/samfleming/dev/hw/haiCore-mv184/node_modules /Users/samfleming/dev/hw/haiCore-v185/node_modules
cd /Users/samfleming/dev/hw/haiCore-v185 && npm run build:protocol        # protocol dist first (worktree rule)
docker exec infrastructure-postgres-1 psql -U haiwave -d haiwave -c "CREATE DATABASE haiwave_v185_test"
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npm run db:apply -- status
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npm run db:apply -- migrate
```
Expected: `status` lists 0001…0045 pending on the fresh DB, `migrate` applies them all and exits 0. If `db:apply` reads `../../.env` and that overrides `DATABASE_URL`, pass the URL as an env var AFTER the script's own env-file (check `apps/core/src/db/apply-migrations.ts` for precedence) — the lane DB name must appear in the command's own log line.

- [ ] **Step 2: Write the failing test (migration applied + columns usable)**

```ts
// apps/core/src/db/__tests__/migration-0046-run-archive.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createTestDatabase, endTestDatabase, seedParticipant } from '../../test-utils/db.js';
import { watcherRuns, auditRuns, watcherSnapshots, runTemplates } from '../schema/index.js';
import type { Database } from '../index.js';

// v1.85 (2026-09-02) — migration 0046: archive columns on both run tables and
// watcher_snapshots.template_id no longer cascades on template delete.
describe('migration 0046 run archive', () => {
  let db: Database;
  let participantId: string;
  beforeAll(async () => {
    db = await createTestDatabase();
    participantId = await seedParticipant(db, { legalName: 'Archive Co' });
  });
  afterAll(async () => { await endTestDatabase(); });

  it('stores and reads archived_at + template_name_snapshot on watcher_runs and audit_runs', async () => {
    const when = new Date('2026-09-02T12:00:00.000Z');
    const [w] = await db.insert(watcherRuns).values({
      initiatorParticipantId: participantId, signalTypes: ['lead_time_distribution'],
      scopeSnapshot: {}, archivedAt: when, templateNameSnapshot: 'old watcher',
    }).returning();
    expect(w.archivedAt?.toISOString()).toBe(when.toISOString());
    expect(w.templateNameSnapshot).toBe('old watcher');
    const [a] = await db.insert(auditRuns).values({
      initiatorParticipantId: participantId, scopeSnapshot: { scope_ids: [], resolved_products: [] },
      status: 'complete', archivedAt: when, templateNameSnapshot: 'old audit',
    }).returning();
    expect(a.archivedAt?.toISOString()).toBe(when.toISOString());
    expect(a.templateNameSnapshot).toBe('old audit');
  });

  it('keeps a watcher snapshot row (template_id set null) when its template is deleted', async () => {
    const [tpl] = await db.insert(runTemplates).values({
      initiatorParticipantId: participantId, templateName: 'snap', observationClass: 'watcher',
      cadence: { kind: 'manual_only' }, scope: { kind: 'watcher', authorization_basis: 'bilateral', counterparties: [], signal_types: ['lead_time_distribution'], skus: [], depth_limit: 1 },
      enabled: true, retentionDays: 90,
    }).returning();
    const [run] = await db.insert(watcherRuns).values({
      initiatorParticipantId: participantId, signalTypes: ['lead_time_distribution'], scopeSnapshot: {}, templateId: tpl.templateId,
    }).returning();
    const [snap] = await db.insert(watcherSnapshots).values({
      watcherRunId: run.runId, templateId: tpl.templateId, initiatorParticipantId: participantId,
      vendorParticipantId: participantId, signalType: 'lead_time_distribution', leadTimeDays: 10, capturedAt: new Date(),
    }).returning();
    await db.delete(runTemplates).where(eq(runTemplates.templateId, tpl.templateId));
    const [after] = await db.select().from(watcherSnapshots).where(eq(watcherSnapshots.snapshotId, snap.snapshotId));
    expect(after).toBeDefined();
    expect(after.templateId).toBeNull();
  });

  it('has the partial indexes for the active (non-archived) list scans', async () => {
    const rows = await db.execute(sql`select indexname from pg_indexes where indexname in ('idx_watcher_runs_active_initiator_triggered','idx_audit_runs_active_initiator_triggered')`);
    expect((rows as unknown as { rows: Array<{ indexname: string }> }).rows.map((r) => r.indexname).sort())
      .toEqual(['idx_audit_runs_active_initiator_triggered', 'idx_watcher_runs_active_initiator_triggered']);
  });
});
```
If `runTemplates` insert requires other NOT NULL columns, copy the minimal values from an existing test that inserts a template (`apps/core/src/services/__tests__/run-template-service.test.ts`, its `create` fixture) rather than guessing. If `db.execute` returns an array instead of `{ rows }` for this driver, adapt the last assertion to the shape an existing test uses (`grep -rn "db.execute(sql" apps/core/src --include=*.test.ts`).

- [ ] **Step 3: Run it — must fail because the columns do not exist**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/db/__tests__/migration-0046-run-archive.test.ts --maxWorkers=1
```
Expected: FAIL — TypeScript/drizzle rejects `archivedAt` on the insert value, or Postgres answers `column "archived_at" does not exist`. The third test fails with an empty index list. The second test fails because the snapshot row is gone (cascade).

- [ ] **Step 4: Write the migration**

```sql
-- 0046_run_archive_on_template_delete.sql
-- v1.85 (2026-09-02), D-206. When a run template is deleted the caller chooses
-- what happens to its prior runs (delete / archive / keep). Archived runs stay,
-- hidden from every list and rollup by default (archived_at IS NULL), and keep
-- the template's name through template_name_snapshot because template_id is
-- SET NULL by the existing FK once the template row is gone.
ALTER TABLE watcher_runs ADD COLUMN archived_at timestamptz;
ALTER TABLE watcher_runs ADD COLUMN template_name_snapshot text;
ALTER TABLE audit_runs ADD COLUMN archived_at timestamptz;
ALTER TABLE audit_runs ADD COLUMN template_name_snapshot text;
-- The active-list scan (initiator, newest first) excludes archived rows; index only those.
CREATE INDEX idx_watcher_runs_active_initiator_triggered
  ON watcher_runs (initiator_participant_id, triggered_at DESC) WHERE archived_at IS NULL;
CREATE INDEX idx_audit_runs_active_initiator_triggered
  ON audit_runs (initiator_participant_id, triggered_at DESC) WHERE archived_at IS NULL;
-- watcher_snapshots.template_id cascaded on template delete (0041 made it
-- nullable but kept the cascade), erasing drift history the runs still own.
-- Archived and kept runs keep their snapshots: SET NULL like the run tables.
ALTER TABLE watcher_snapshots DROP CONSTRAINT watcher_snapshots_template_id_run_templates_template_id_fk;
ALTER TABLE watcher_snapshots
  ADD CONSTRAINT watcher_snapshots_template_id_run_templates_template_id_fk
  FOREIGN KEY (template_id) REFERENCES run_templates(template_id) ON DELETE SET NULL;
```
Verify the constraint NAME before writing it: `docker exec infrastructure-postgres-1 psql -U haiwave -d haiwave_v185_test -c "\d watcher_snapshots"` and use the printed FK name verbatim.

Append to `apps/core/drizzle/meta/_journal.json` after the idx 45 entry (keep the JSON valid, same fields as the previous entries):
```json
    {
      "idx": 46,
      "version": "7",
      "when": 1788000000000,
      "tag": "0046_run_archive_on_template_delete",
      "breakpoints": true
    }
```
(`when` = current epoch ms; use `date +%s000`.)

- [ ] **Step 5: Schema changes**

In `apps/core/src/db/schema/watcher-runs.ts`, after `lastPosition`:
```ts
  // v1.85 (2026-09-02), D-206 — set when the run's template was deleted with
  // runs=archive: hidden from every default list, still readable by id.
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  // The template's name at delete time (archive and keep). template_id is
  // SET NULL once the template row is gone, so this is the only name left.
  templateNameSnapshot: text('template_name_snapshot'),
```
and in the index array:
```ts
  index('idx_watcher_runs_active_initiator_triggered')
    .on(table.initiatorParticipantId, table.triggeredAt.desc())
    .where(sql`${table.archivedAt} IS NULL`),
```
Same two columns and the index `idx_audit_runs_active_initiator_triggered` in `audit-runs.ts` (`.on(table.initiatorParticipantId, table.triggeredAt.desc())`).
In `watcher-snapshots.ts` line 17: `{ onDelete: 'cascade' }` → `{ onDelete: 'set null' }` and update the comment above it: "SET NULL since 0046: archived/kept runs keep their drift history when the template goes."

- [ ] **Step 6: Apply the migration to the lane DB and run the test to green**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npm run db:apply -- status
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npm run db:apply -- migrate
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/db/__tests__/migration-0046-run-archive.test.ts --maxWorkers=1
```
Expected: `status` shows 0046 pending, `migrate` applies exactly 0046, the three tests PASS.

- [ ] **Step 7: Build and commit**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185 && npm run build
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/drizzle/0046_run_archive_on_template_delete.sql apps/core/drizzle/meta/_journal.json apps/core/src/db/schema/watcher-runs.ts apps/core/src/db/schema/audit-runs.ts apps/core/src/db/schema/watcher-snapshots.ts apps/core/src/db/__tests__/migration-0046-run-archive.test.ts && git commit -m "feat(db): 0046 run archive columns; watcher_snapshots.template_id SET NULL (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Report to the controller: "PG 0046 WRITTEN" (the controller messages agent1).

---

### Task 2: Protocol 3.80.0 — `archived_at`, disposition and delete-response schemas, changelog

**Files:**
- Modify: `packages/protocol/src/watcher/run.ts` (WatcherRunSchema)
- Modify: `packages/protocol/src/audit/traversal.ts:199-245` (AuditRunSchema)
- Create: `packages/protocol/src/run-template/delete.ts`
- Modify: `packages/protocol/src/run-template/index.ts` (export)
- Modify: `packages/protocol/src/version.ts` (constant + changelog)
- Test: `packages/protocol/src/run-template/__tests__/delete.test.ts`, `packages/protocol/src/__tests__/version-3.80.0.test.ts`

**Interfaces:**
- Produces: `RunsDispositionSchema` / `RunsDisposition` (`'delete' | 'archive' | 'keep'`), `RunTemplateDeleteResponseSchema` / `RunTemplateDeleteResponse` (`{ deleted: true, runs: { disposition, affected } }`), `WatcherRun.archived_at?: string | null`, `AuditRun.archived_at?: string | null`, `PROTOCOL_VERSION = '3.80.0'`.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/protocol/src/run-template/__tests__/delete.test.ts
import { describe, it, expect } from 'vitest';
import { RunsDispositionSchema, RunTemplateDeleteResponseSchema } from '../delete.js';
import { WatcherRunSchema } from '../../watcher/run.js';
import { AuditRunSchema } from '../../audit/traversal.js';

describe('3.80.0 run disposition schemas', () => {
  it('accepts exactly delete | archive | keep', () => {
    expect(RunsDispositionSchema.parse('archive')).toBe('archive');
    expect(() => RunsDispositionSchema.parse('purge')).toThrow();
  });
  it('parses the delete response envelope', () => {
    const r = RunTemplateDeleteResponseSchema.parse({ deleted: true, runs: { disposition: 'keep', affected: 0 } });
    expect(r.runs.affected).toBe(0);
    expect(() => RunTemplateDeleteResponseSchema.parse({ deleted: false, runs: { disposition: 'keep', affected: 0 } })).toThrow();
  });
  it('run envelopes accept archived_at as null, a datetime, or absent', () => {
    const base = {
      run_id: '00000000-0000-0000-0000-000000000001', initiator_participant_id: '00000000-0000-0000-0000-000000000002',
      status: 'complete', signal_types: ['lead_time_distribution'], counterparty_filter: null, cadence: 'on_demand',
      observation_class: 'continuous', triggered_at: '2026-09-02T12:00:00.000Z', completed_at: null, cancelled_at: null,
      transformation_chain: null, depth_limit: 1,
    };
    expect(WatcherRunSchema.parse(base).archived_at).toBeUndefined();
    expect(WatcherRunSchema.parse({ ...base, archived_at: null }).archived_at).toBeNull();
    expect(WatcherRunSchema.parse({ ...base, archived_at: '2026-09-02T13:00:00.000Z' }).archived_at).toBe('2026-09-02T13:00:00.000Z');
    const audit = {
      run_id: base.run_id, initiator_participant_id: base.initiator_participant_id, triggered_at: base.triggered_at,
      triggered_by_user_id: null, scope_snapshot: { scope_ids: [], resolved_products: [] }, status: 'complete',
      completed_at: null, cancelled_at: null, depth_limit: 1, hop_count: null, gap_count: null, error_message: null,
    };
    expect(AuditRunSchema.parse({ ...audit, archived_at: null }).archived_at).toBeNull();
  });
});
```
```ts
// packages/protocol/src/__tests__/version-3.80.0.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROTOCOL_VERSION } from '../version.js';

describe('protocol 3.80.0', () => {
  it('is the current version', () => { expect(PROTOCOL_VERSION).toBe('3.80.0'); });
  it('the changelog names every parked §P item as deferred to 3.81.0', () => {
    const src = readFileSync(resolve(__dirname, '../version.ts'), 'utf8');
    const entry = src.slice(src.indexOf('// 3.80.0 ('));
    for (const item of ['unit_price: 0', "'EA' UoM", 'lead-time range', 'quantity-only promise cut', 'retry_config', 'order_records.status CHECK', 'PO/notes asymmetry', 'F-G1-1', 'deep-link producer']) {
      expect(entry, `changelog must name ${item}`).toContain(item);
    }
    expect(entry).toContain('DEFERRED to 3.81.0');
  });
});
```
(Adjust the WatcherRun base fixture if `WatcherRunSchema` requires a field not listed; copy from `packages/protocol/src/watcher/__tests__` fixtures if one exists.)

- [ ] **Step 2: Run — must fail (module `../delete.js` missing; version is 3.79.0)**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/packages/protocol && npx vitest run src/run-template/__tests__/delete.test.ts src/__tests__/version-3.80.0.test.ts --maxWorkers=1
```

- [ ] **Step 3: Implement**

`packages/protocol/src/run-template/delete.ts`:
```ts
import { z } from 'zod';

// v1.85 (2026-09-02), D-206 — what happens to a template's prior runs when
// the template is deleted. Audit templates accept only 'archive' (server
// enforced); watcher templates default to 'keep' when the caller sends nothing.
export const RunsDispositionSchema = z.enum(['delete', 'archive', 'keep']);
export type RunsDisposition = z.infer<typeof RunsDispositionSchema>;

export const RunTemplateDeleteResponseSchema = z.object({
  deleted: z.literal(true),
  runs: z.object({
    disposition: RunsDispositionSchema,
    // Runs the disposition touched: rows archived, rows named (keep), or rows deleted.
    affected: z.number().int().nonnegative(),
  }),
});
export type RunTemplateDeleteResponse = z.infer<typeof RunTemplateDeleteResponseSchema>;
```
`packages/protocol/src/run-template/index.ts`: add `export * from './delete.js';`.

`WatcherRunSchema` (after `template_name`):
```ts
  // v1.85 (3.80.0), D-206: set when the run's template was deleted with
  // runs=archive. Lists omit archived runs unless asked (?archived=true).
  // Nullable + optional so older servers that don't send it still parse.
  archived_at: z.string().datetime().nullable().optional(),
```
Same block in `AuditRunSchema` after `template_name`.

`version.ts`: change the constant to `'3.80.0'`, and insert above it, after the 3.79.0 entry:
```ts
// 3.80.0 (2026-09-02, v1.85 PR 2 — D-206 run disposition on template delete): ADDITIVE.
// (a) WatcherRunSchema and AuditRunSchema gain `archived_at` (nullable, optional).
// (b) run-template/delete.ts: RunsDispositionSchema (delete | archive | keep) and
//     RunTemplateDeleteResponseSchema for DELETE /sonar/templates/:id?runs=… which
//     now answers 200 with a body instead of 204. No request body changes.
// Docket condition (agent1, 2026-09-02): every item parked behind this mint since
// group 5 (§P) is DEFERRED to 3.81.0, none carried — scorer `unit_price: 0` ·
// 'EA' UoM on the offering wire · catalog lead-time range · quantity-only promise
// cut · retry_config · order_records.status CHECK · PO/notes asymmetry · F-G1-1
// basis/site on the wire · deep-link producer.
// Next free: 3.81.0.
```
Also update the `// Next free: 3.80.0.` line of the 3.79.0 entry to `// Next free: 3.81.0.`? No — leave prior entries untouched; only the newest entry states the next free number. Bump `packages/protocol/package.json` `"version"` to `3.80.0` as well (check whether prior bumps did so: `git log -p -1 --follow packages/protocol/package.json | head`; follow that precedent).

- [ ] **Step 4: Run the two protocol tests, then the whole protocol package**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/packages/protocol && npx vitest run --maxWorkers=3 --minWorkers=1
cd /Users/samfleming/dev/hw/haiCore-v185 && npm run build:protocol
```
Expected: PASS, build exit 0. If a protocol conformance/snapshot test pins the version string or the schema key list, update that pin in the same commit and say so.

- [ ] **Step 5: Commit**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185 && git add packages/protocol && git commit -m "feat(protocol): 3.80.0 — archived_at on run envelopes, RunsDisposition, delete response (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Report: "PROTOCOL 3.80.0 WRITTEN".

---

### Task 3: `RunTemplateService.delete` with run disposition

**Files:**
- Modify: `apps/core/src/services/run-template-service.ts:47-55` (RunTemplateError kinds + details), `:267-278` (delete)
- Test: `apps/core/src/services/__tests__/run-template-delete-disposition.test.ts`

**Interfaces:**
- Consumes: `watcherRuns.archivedAt/templateNameSnapshot`, `auditRuns.archivedAt/templateNameSnapshot` (Task 1); `RunsDisposition`, `RunTemplateDeleteResponse` from `@haiwave/protocol` (Task 2).
- Produces: `delete(participantId: string, templateId: string, options?: { runs?: RunsDisposition }): Promise<RunTemplateDeleteResponse | null>` (null = not found / not owned). Throws `RunTemplateError` with kind `'audit_runs_archive_only'` or `'runs_in_flight'` (`details.running_count`).

- [ ] **Step 1: Write the failing tests**

```ts
// apps/core/src/services/__tests__/run-template-delete-disposition.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase, endTestDatabase, seedParticipant } from '../../test-utils/db.js';
import { RunTemplateService, RunTemplateError } from '../run-template-service.js';
import { runTemplates, watcherRuns, auditRuns, watcherSnapshots } from '../../db/schema/index.js';
import type { Database } from '../../db/index.js';
import type { RunServiceRegistry } from '../run-template-service.js';

// v1.85 (2026-09-02), D-206 — delete decides what happens to prior runs.
describe('RunTemplateService.delete run disposition', () => {
  let db: Database; let participantId: string; let svc: RunTemplateService;
  beforeAll(async () => {
    db = await createTestDatabase();
    participantId = await seedParticipant(db, { legalName: 'Disposition Co' });
    // No triggers happen here; an empty registry is enough for delete().
    svc = new RunTemplateService(db, {} as RunServiceRegistry);
  });
  afterAll(async () => { await endTestDatabase(); });
  beforeEach(async () => {
    await db.delete(watcherRuns).where(eq(watcherRuns.initiatorParticipantId, participantId));
    await db.delete(auditRuns).where(eq(auditRuns.initiatorParticipantId, participantId));
    await db.delete(runTemplates).where(eq(runTemplates.initiatorParticipantId, participantId));
  });

  async function watcherTemplate(name = 'w') {
    const [t] = await db.insert(runTemplates).values({
      initiatorParticipantId: participantId, templateName: name, observationClass: 'watcher',
      cadence: { kind: 'manual_only' },
      scope: { kind: 'watcher', authorization_basis: 'bilateral', counterparties: [], signal_types: ['lead_time_distribution'], skus: [], depth_limit: 1 },
      enabled: true, retentionDays: 90,
    }).returning();
    return t.templateId;
  }
  async function auditTemplate(name = 'a') {
    const [t] = await db.insert(runTemplates).values({
      initiatorParticipantId: participantId, templateName: name, observationClass: 'audit',
      cadence: { kind: 'manual_only' },
      scope: { kind: 'audit', authorization_basis: 'bilateral', counterparties: [], signal_types: [], skus: [], depth_limit: 2, hop_budget: 5 },
      enabled: true, retentionDays: 90,
    }).returning();
    return t.templateId;
  }
  async function watcherRun(templateId: string, status = 'complete') {
    const [r] = await db.insert(watcherRuns).values({
      initiatorParticipantId: participantId, signalTypes: ['lead_time_distribution'], scopeSnapshot: {}, templateId, status,
    }).returning();
    return r.runId;
  }
  async function auditRun(templateId: string, status = 'complete') {
    const [r] = await db.insert(auditRuns).values({
      initiatorParticipantId: participantId, scopeSnapshot: { scope_ids: [], resolved_products: [] }, status, templateId,
    }).returning();
    return r.runId;
  }

  it('returns null for a template the caller does not own', async () => {
    const other = await seedParticipant(db, { legalName: 'Other Co' });
    const id = await watcherTemplate();
    expect(await svc.delete(other, id, { runs: 'archive' })).toBeNull();
    expect((await db.select().from(runTemplates).where(eq(runTemplates.templateId, id))).length).toBe(1);
  });

  it('watcher default (no runs option) keeps runs and stamps the name', async () => {
    const id = await watcherTemplate('nightly');
    const runId = await watcherRun(id);
    const res = await svc.delete(participantId, id);
    expect(res).toEqual({ deleted: true, runs: { disposition: 'keep', affected: 1 } });
    const [row] = await db.select().from(watcherRuns).where(eq(watcherRuns.runId, runId));
    expect(row.archivedAt).toBeNull();
    expect(row.templateId).toBeNull();
    expect(row.templateNameSnapshot).toBe('nightly');
  });

  it('watcher archive stamps archived_at and the name on every run', async () => {
    const id = await watcherTemplate('weekly');
    const a = await watcherRun(id); const b = await watcherRun(id, 'failed');
    const res = await svc.delete(participantId, id, { runs: 'archive' });
    expect(res?.runs).toEqual({ disposition: 'archive', affected: 2 });
    for (const runId of [a, b]) {
      const [row] = await db.select().from(watcherRuns).where(eq(watcherRuns.runId, runId));
      expect(row.archivedAt).not.toBeNull();
      expect(row.templateNameSnapshot).toBe('weekly');
    }
  });

  it('watcher delete removes the runs and their snapshots', async () => {
    const id = await watcherTemplate();
    const runId = await watcherRun(id);
    await db.insert(watcherSnapshots).values({
      watcherRunId: runId, templateId: id, initiatorParticipantId: participantId, vendorParticipantId: participantId,
      signalType: 'lead_time_distribution', leadTimeDays: 3, capturedAt: new Date(),
    });
    const res = await svc.delete(participantId, id, { runs: 'delete' });
    expect(res?.runs).toEqual({ disposition: 'delete', affected: 1 });
    expect((await db.select().from(watcherRuns).where(eq(watcherRuns.runId, runId))).length).toBe(0);
    expect((await db.select().from(watcherSnapshots).where(eq(watcherSnapshots.watcherRunId, runId))).length).toBe(0);
  });

  it('audit always archives; delete and keep are refused before anything changes', async () => {
    const id = await auditTemplate('q1');
    const runId = await auditRun(id);
    for (const runs of ['delete', 'keep'] as const) {
      await expect(svc.delete(participantId, id, { runs })).rejects.toMatchObject({ kind: 'audit_runs_archive_only' });
    }
    expect((await db.select().from(runTemplates).where(eq(runTemplates.templateId, id))).length).toBe(1);
    const res = await svc.delete(participantId, id);
    expect(res?.runs).toEqual({ disposition: 'archive', affected: 1 });
    const [row] = await db.select().from(auditRuns).where(eq(auditRuns.runId, runId));
    expect(row.archivedAt).not.toBeNull();
    expect(row.templateNameSnapshot).toBe('q1');
  });

  it('refuses delete and archive while a run is running, and leaves everything untouched', async () => {
    const id = await watcherTemplate();
    await watcherRun(id, 'running');
    for (const runs of ['delete', 'archive'] as const) {
      await expect(svc.delete(participantId, id, { runs })).rejects.toMatchObject({ kind: 'runs_in_flight', details: { running_count: 1 } });
    }
    expect((await db.select().from(runTemplates).where(eq(runTemplates.templateId, id))).length).toBe(1);
    const res = await svc.delete(participantId, id, { runs: 'keep' });
    expect(res?.runs.disposition).toBe('keep');
  });

  it('phantom_demand templates delete as before (no run table touched)', async () => {
    const [t] = await db.insert(runTemplates).values({
      initiatorParticipantId: participantId, templateName: 'pd', observationClass: 'phantom_demand',
      cadence: { kind: 'manual_only' },
      scope: { kind: 'phantom_demand', authorization_basis: 'bilateral', counterparty: participantId, skus: ['X'], hypothetical_quantity: 1, hypothetical_timeline: null },
      enabled: true, retentionDays: 90,
    }).returning();
    const res = await svc.delete(participantId, t.templateId, { runs: 'archive' });
    expect(res).toEqual({ deleted: true, runs: { disposition: 'keep', affected: 0 } });
  });
});
```
If `runTemplates.scope` for `phantom_demand` needs different required fields, copy the shape from `apps/core/src/services/__tests__/run-template-service.test.ts` (its phantom_demand fixture) rather than guessing.

- [ ] **Step 2: Run — must fail (delete ignores options; returns boolean)**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/services/__tests__/run-template-delete-disposition.test.ts --maxWorkers=1
```
Expected: FAIL — `expect(res).toEqual({deleted:true,…})` receives `true`; `rejects.toMatchObject` cases resolve instead of rejecting.

- [ ] **Step 3: Implement**

In `run-template-service.ts` extend the error:
```ts
export class RunTemplateError extends Error {
  constructor(
    public readonly kind:
      | 'not_found' | 'disabled' | 'scope_immutable'
      // v1.85 (2026-09-02), D-206
      | 'audit_runs_archive_only' | 'runs_in_flight',
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'RunTemplateError';
  }
}
```
Imports to add: `import { count, isNull } from 'drizzle-orm';` (keep existing `and, desc, eq`), `import { watcherRuns, auditRuns } from '../db/schema/index.js';` (if not already), and `import type { RunsDisposition, RunTemplateDeleteResponse } from '@haiwave/protocol';`.

Replace `delete`:
```ts
  /**
   * v1.85 (2026-09-02), D-206 — delete the template and apply the caller's
   * disposition to its prior runs, in one transaction:
   *   delete  — remove the runs (children cascade on run_id);
   *   archive — stamp archived_at, hidden from default lists (audit: always);
   *   keep    — leave the runs on the active list (watcher default).
   * Archive and keep stamp template_name_snapshot first, because the run
   * tables' template_id is SET NULL by FK once the template row is gone.
   * A running run blocks delete and archive (409 upstream): archiving would
   * hide an in-flight run, deleting would orphan its orchestrator.
   */
  async delete(
    participantId: string,
    templateId: string,
    options: { runs?: RunsDisposition } = {},
  ): Promise<RunTemplateDeleteResponse | null> {
    const template = await this.get(participantId, templateId);
    if (!template) return null;

    let disposition: RunsDisposition;
    if (template.observation_class === 'audit') {
      if (options.runs !== undefined && options.runs !== 'archive') {
        throw new RunTemplateError(
          'audit_runs_archive_only',
          'Audit runs are always archived when their definition is deleted; delete and keep are not options.',
        );
      }
      disposition = 'archive';
    } else if (template.observation_class === 'watcher') {
      disposition = options.runs ?? 'keep';
    } else {
      // phantom_demand: no run handling in this release (spec §7); runs stay as today.
      disposition = 'keep';
    }

    return this.db.transaction(async (tx) => {
      let affected = 0;
      if (template.observation_class === 'watcher') {
        affected = await applyDisposition(tx, watcherRuns, templateId, template.template_name, disposition);
      } else if (template.observation_class === 'audit') {
        affected = await applyDisposition(tx, auditRuns, templateId, template.template_name, disposition);
      }
      const gone = await tx
        .delete(runTemplates)
        .where(and(eq(runTemplates.templateId, templateId), eq(runTemplates.initiatorParticipantId, participantId)))
        .returning({ id: runTemplates.templateId });
      if (gone.length === 0) {
        // Deleted between get() and here; nothing to report as done.
        throw new RunTemplateError('not_found', 'Template not found or not owned by caller');
      }
      return { deleted: true, runs: { disposition, affected } };
    });
  }
```
And a module-level helper (above the class), written once for both tables via the shared column names:
```ts
type RunTable = typeof watcherRuns | typeof auditRuns;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

async function applyDisposition(
  tx: Tx,
  table: RunTable,
  templateId: string,
  templateName: string,
  disposition: RunsDisposition,
): Promise<number> {
  if (disposition !== 'keep') {
    const [{ running }] = await tx
      .select({ running: count() })
      .from(table)
      .where(and(eq(table.templateId, templateId), eq(table.status, 'running')));
    if (Number(running) > 0) {
      throw new RunTemplateError(
        'runs_in_flight',
        `${running} run(s) of this definition are still running; wait for them to finish or cancel them first.`,
        { running_count: Number(running) },
      );
    }
  }
  if (disposition === 'delete') {
    const rows = await tx.delete(table).where(eq(table.templateId, templateId)).returning({ id: table.runId });
    return rows.length;
  }
  const rows = await tx
    .update(table)
    .set({
      templateNameSnapshot: templateName,
      ...(disposition === 'archive' ? { archivedAt: new Date() } : {}),
    })
    .where(eq(table.templateId, templateId))
    .returning({ id: table.runId });
  return rows.length;
}
```
If TypeScript rejects `tx.update(table).set(...)` on the union type, split `applyDisposition` into two identical functions `applyWatcherDisposition(tx, …)` / `applyAuditDisposition(tx, …)` typed to one table each; do not use `any`. If `Database['transaction']` typing does not yield the tx type, look at how `audit-service.ts:11` types its `tx` parameter and reuse that alias.

- [ ] **Step 4: Run to green; then the existing service tests that call delete**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/services/__tests__/run-template-delete-disposition.test.ts src/services/__tests__/run-template-service.test.ts src/services/__tests__/run-template-cleanup-service.test.ts --maxWorkers=2 --minWorkers=1
```
Expected: all PASS. If an existing test asserted `delete()` returns `true`/`false`, update it to the new shape (`toMatchObject({ deleted: true })` / `toBeNull()`) in the same commit.

- [ ] **Step 5: Commit**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/services/run-template-service.ts apps/core/src/services/__tests__/ && git commit -m "feat(run-templates): delete applies a run disposition — delete/archive/keep, audit always archive (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `DELETE /sonar/templates/:template_id?runs=` route

**Files:**
- Modify: `apps/core/src/routes/run-templates.ts:141-151`
- Test: `apps/core/src/routes/__tests__/run-templates.test.ts` (append a describe)

**Interfaces:**
- Consumes: `RunTemplateService.delete(participantId, templateId, { runs })` (Task 3), `RunsDispositionSchema` (Task 2).
- Produces: `DELETE /sonar/templates/:template_id?runs=delete|archive|keep` → 200 `RunTemplateDeleteResponse`; 400 `VALIDATION_ERROR` (bad `runs`), 400 `AUDIT_RUNS_ARCHIVE_ONLY`, 404, 409 `RUNS_IN_FLIGHT { running_count }`.

- [ ] **Step 1: Write the failing tests** (append to `run-templates.test.ts`, inside the file's existing app/db setup; reuse its `seedParticipant` + auth helpers exactly as the existing DELETE/GET tests do — read the file's `describe('DELETE …')` if present and mirror its request construction)

```ts
describe('DELETE /sonar/templates/:id?runs= (D-206)', () => {
  it('answers 200 with the disposition body and defaults a watcher to keep', async () => {
    const id = await createWatcherTemplateViaApi(app, token);      // use the file's existing create helper
    const res = await app.inject({ method: 'DELETE', url: `/sonar/templates/${id}`, headers: auth(token) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true, runs: { disposition: 'keep', affected: 0 } });
  });
  it('400s an unknown runs value without deleting', async () => {
    const id = await createWatcherTemplateViaApi(app, token);
    const res = await app.inject({ method: 'DELETE', url: `/sonar/templates/${id}?runs=purge`, headers: auth(token) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect((await app.inject({ method: 'GET', url: `/sonar/templates/${id}`, headers: auth(token) })).statusCode).toBe(200);
  });
  it('400s AUDIT_RUNS_ARCHIVE_ONLY for an audit template with runs=delete', async () => {
    const id = await createAuditTemplateViaApi(app, token);
    const res = await app.inject({ method: 'DELETE', url: `/sonar/templates/${id}?runs=delete`, headers: auth(token) });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('AUDIT_RUNS_ARCHIVE_ONLY');
  });
  it('409s RUNS_IN_FLIGHT with the running count', async () => {
    const id = await createWatcherTemplateViaApi(app, token);
    await db.insert(watcherRuns).values({ initiatorParticipantId: participantId, signalTypes: ['lead_time_distribution'], scopeSnapshot: {}, templateId: id, status: 'running' });
    const res = await app.inject({ method: 'DELETE', url: `/sonar/templates/${id}?runs=archive`, headers: auth(token) });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('RUNS_IN_FLIGHT');
    expect(res.json().error.details.running_count).toBe(1);
  });
  it('404s a template the caller does not own', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/sonar/templates/00000000-0000-0000-0000-000000000009?runs=keep`, headers: auth(token) });
    expect(res.statusCode).toBe(404);
  });
});
```
Replace `createWatcherTemplateViaApi` / `createAuditTemplateViaApi` / `auth(token)` with the file's own helper names (they exist under other names in that file; do not invent a second auth path).

- [ ] **Step 2: Run — must fail (204 empty body; no 400/409 mapping)**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/routes/__tests__/run-templates.test.ts --maxWorkers=1
```

- [ ] **Step 3: Implement the route**

```ts
  // v1.85 (2026-09-02), D-206 — the caller chooses what happens to prior runs.
  app.delete<{ Params: { template_id: string }; Querystring: { runs?: string } }>('/templates/:template_id', {
    preHandler: [app.authenticate, requireScopes(SCOPES.RUN_TEMPLATE_WRITE)],
  }, async (request, reply) => {
    const callerId = requireJwtParticipantId(request, reply);
    if (!callerId) return;

    const parsed = RunsDispositionSchema.optional().safeParse(request.query.runs);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'runs must be one of delete, archive, keep', timestamp: new Date().toISOString(), request_id: request.id },
      });
    }
    try {
      const result = await app.services.runTemplate.delete(callerId, request.params.template_id, { runs: parsed.data });
      if (!result) return notFound(reply, request.id);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof RunTemplateError && err.kind === 'audit_runs_archive_only') {
        return reply.status(400).send({ error: { code: 'AUDIT_RUNS_ARCHIVE_ONLY', message: err.message, timestamp: new Date().toISOString(), request_id: request.id } });
      }
      if (err instanceof RunTemplateError && err.kind === 'runs_in_flight') {
        return reply.status(409).send({ error: { code: 'RUNS_IN_FLIGHT', message: err.message, details: err.details, timestamp: new Date().toISOString(), request_id: request.id } });
      }
      if (err instanceof RunTemplateError && err.kind === 'not_found') return notFound(reply, request.id);
      throw err;
    }
  });
```
Import `RunsDispositionSchema` from `@haiwave/protocol`. Match the existing error envelope shape in this file (`error: { code, message, timestamp, request_id }`, `details` where used at line ~235).

- [ ] **Step 4: Green, then commit**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/routes/__tests__/run-templates.test.ts --maxWorkers=1
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/routes/run-templates.ts apps/core/src/routes/__tests__/run-templates.test.ts && git commit -m "feat(routes): DELETE /sonar/templates/:id?runs= — 200 body, 400/409 dispositions (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Watcher run list — exclude archived by default, `?archived=`, name coalesce, `archived_at` on the wire

**Files:**
- Modify: `apps/core/src/services/watcher-run-service.ts:517-533` (list), `:832-855` (mapRun)
- Modify: `apps/core/src/routes/watcher.ts:65-72`
- Test: `apps/core/src/services/__tests__/watcher-run-service-archive.test.ts`, `apps/core/src/routes/__tests__/watcher.test.ts` (append; find the file that covers `GET /runs`)

**Interfaces:**
- Produces: `WatcherRunService.list(initiatorId: string, opts?: { archived?: boolean }): Promise<WatcherRun[]>`; `GET /sonar/watcher/runs?archived=true|false`; `WatcherRun.archived_at`, `WatcherRun.template_name` = template name or snapshot.

- [ ] **Step 1: Write the failing service test**

```ts
// apps/core/src/services/__tests__/watcher-run-service-archive.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase, endTestDatabase, seedParticipant } from '../../test-utils/db.js';
import { watcherRuns } from '../../db/schema/index.js';
import type { Database } from '../../db/index.js';
import { makeWatcherRunService } from './watcher-run-service-template.test.js'; // if not exported there, copy that file's factory into this file verbatim

describe('WatcherRunService.list archive filter (D-206)', () => {
  let db: Database; let me: string;
  beforeAll(async () => { db = await createTestDatabase(); me = await seedParticipant(db, { legalName: 'W Co' }); });
  afterAll(async () => { await endTestDatabase(); });
  beforeEach(async () => { await db.delete(watcherRuns).where(eq(watcherRuns.initiatorParticipantId, me)); });

  async function run(extra: Partial<typeof watcherRuns.$inferInsert>) {
    const [r] = await db.insert(watcherRuns).values({ initiatorParticipantId: me, signalTypes: ['lead_time_distribution'], scopeSnapshot: {}, status: 'complete', ...extra }).returning();
    return r.runId;
  }

  it('omits archived runs by default and returns only them for archived=true', async () => {
    const active = await run({});
    const archived = await run({ archivedAt: new Date(), templateNameSnapshot: 'gone' });
    const svc = makeWatcherRunService(db);
    expect((await svc.list(me)).map((r) => r.run_id)).toEqual([active]);
    expect((await svc.list(me, { archived: false })).map((r) => r.run_id)).toEqual([active]);
    const arch = await svc.list(me, { archived: true });
    expect(arch.map((r) => r.run_id)).toEqual([archived]);
    expect(arch[0].archived_at).not.toBeNull();
    expect(arch[0].template_name).toBe('gone');
  });

  it('serialises archived_at as null on active runs and prefers the live template name', async () => {
    const id = await run({ templateNameSnapshot: 'kept name' });
    const svc = makeWatcherRunService(db);
    const [row] = await svc.list(me);
    expect(row.run_id).toBe(id);
    expect(row.archived_at).toBeNull();
    expect(row.template_name).toBe('kept name');
  });
});
```

- [ ] **Step 2: Run — must fail (archived run listed; `archived_at` undefined; name null)**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/services/__tests__/watcher-run-service-archive.test.ts --maxWorkers=1
```

- [ ] **Step 3: Implement**

`list`:
```ts
  async list(initiatorId: string, opts: { archived?: boolean } = {}): Promise<WatcherRun[]> {
    // v1.85 (2026-09-02), D-206 — archived runs (template deleted with
    // runs=archive) are off the active list unless asked for explicitly.
    const archivedClause = opts.archived
      ? isNotNull(watcherRuns.archivedAt)
      : isNull(watcherRuns.archivedAt);
    const rows = await this.db
      .select({ run: watcherRuns, templateName: runTemplates.templateName })
      .from(watcherRuns)
      .leftJoin(runTemplates, eq(runTemplates.templateId, watcherRuns.templateId))
      .where(and(eq(watcherRuns.initiatorParticipantId, initiatorId), archivedClause))
      .orderBy(desc(watcherRuns.triggeredAt))
      .limit(100);
    return rows.map((r) => this.mapRun(r.run, r.templateName));
  }
```
(add `isNull, isNotNull` to the drizzle import). In `mapRun`, replace `template_name: templateName,` with:
```ts
      // Live name while the template exists; the delete-time snapshot after.
      template_name: templateName ?? r.templateNameSnapshot ?? null,
      archived_at: r.archivedAt ? (r.archivedAt as Date).toISOString() : null,
```
Route `watcher.ts` GET `/runs`:
```ts
  app.get<{ Querystring: { archived?: string } }>('/runs', {
    preHandler: [app.authenticate, requireScopes(SCOPES.WATCHER_READ)],
  }, async (request, reply) => {
    const callerId = requireJwtParticipantId(request, reply);
    if (!callerId) return;
    // v1.85 (D-206): ?archived=true lists only archived runs; default hides them.
    const runs = await app.services.watcherRun.list(callerId, { archived: request.query.archived === 'true' });
    return reply.status(200).send({ runs });
  });
```

- [ ] **Step 4: Route test** (append to the watcher routes test file that already covers `GET /runs`; mirror its setup)

```ts
  it('GET /runs hides archived runs unless ?archived=true (D-206)', async () => {
    await db.insert(watcherRuns).values([{ initiatorParticipantId: participantId, signalTypes: ['lead_time_distribution'], scopeSnapshot: {}, status: 'complete' },
      { initiatorParticipantId: participantId, signalTypes: ['lead_time_distribution'], scopeSnapshot: {}, status: 'complete', archivedAt: new Date() }]);
    const active = await app.inject({ method: 'GET', url: '/sonar/watcher/runs', headers: auth(token) });
    expect(active.json().runs).toHaveLength(1);
    expect(active.json().runs[0].archived_at).toBeNull();
    const archived = await app.inject({ method: 'GET', url: '/sonar/watcher/runs?archived=true', headers: auth(token) });
    expect(archived.json().runs).toHaveLength(1);
    expect(archived.json().runs[0].archived_at).not.toBeNull();
  });
```
(Use the route prefix the file's other tests use for the watcher routes.)

- [ ] **Step 5: Green + commit**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/services/__tests__/watcher-run-service-archive.test.ts src/routes/__tests__/watcher.test.ts src/services/__tests__/watcher-run-service.test.ts --maxWorkers=2 --minWorkers=1
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/services/watcher-run-service.ts apps/core/src/routes/watcher.ts apps/core/src/services/__tests__/ apps/core/src/routes/__tests__/ && git commit -m "feat(watcher): run list hides archived runs by default; ?archived=true; name snapshot (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Audit run list — same treatment

**Files:**
- Modify: `apps/core/src/services/audit-run-service.ts:77-81` (ListRunsFilter), `:626-660` (list), `mapRunRow`
- Modify: `apps/core/src/routes/audit-runs.ts:163-195` (GET /runs querystring)
- Test: `apps/core/src/services/__tests__/audit-run-service-archive.test.ts`, the audit-runs route test file (append)

**Interfaces:**
- Produces: `ListRunsFilter.archived?: boolean`; `GET /source-audit/runs?archived=true|false`; `AuditRun.archived_at`; `template_name` coalesced with the snapshot.

- [ ] **Step 1: Failing service test** — same shape as Task 5 using `auditRuns` (insert values: `initiatorParticipantId`, `scopeSnapshot: { scope_ids: [], resolved_products: [] }`, `status: 'complete'`, plus `archivedAt`/`templateNameSnapshot`) and `makeAuditRunService(db)` from `run-template-service.test.ts` (copy the factory verbatim if it is not exported). Assert: default list excludes archived; `{ archived: true }` returns only archived with `archived_at` set and `template_name` = snapshot; active rows carry `archived_at: null`.

- [ ] **Step 2: Run — must fail**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/services/__tests__/audit-run-service-archive.test.ts --maxWorkers=1
```

- [ ] **Step 3: Implement**

`ListRunsFilter` gains `archived?: boolean;`. In `list`, after the status condition:
```ts
    // v1.85 (2026-09-02), D-206 — archived runs are off the active list unless asked.
    conds.push(filter.archived ? isNotNull(auditRuns.archivedAt) : isNull(auditRuns.archivedAt));
```
In `mapRunRow`: `template_name: templateName ?? r.templateNameSnapshot ?? null,` and `archived_at: r.archivedAt?.toISOString() ?? null,`.
Route `audit-runs.ts` GET `/runs`: add `archived?: string` to the Querystring type and pass `archived: q.archived === 'true'` into `app.services.auditRun.list({...})`.

- [ ] **Step 4: Route test** — append to the audit-runs route test: two inserted runs (one archived), `GET /source-audit/runs` → 1 run with `archived_at: null`; `?archived=true` → 1 run with `archived_at` set.

- [ ] **Step 5: Green + commit**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/services/__tests__/audit-run-service-archive.test.ts src/routes/__tests__/audit-runs.test.ts src/services/__tests__/audit-run-service.test.ts --maxWorkers=2 --minWorkers=1
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/services/audit-run-service.ts apps/core/src/routes/audit-runs.ts apps/core/src/services/__tests__/ apps/core/src/routes/__tests__/ && git commit -m "feat(audit): run list hides archived runs by default; ?archived=true; name snapshot (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Secondary readers exclude archived runs

**Files:**
- Modify: `apps/core/src/services/order-promise-feed-service.ts:109-116` (feed: add `isNull(watcherRuns.archivedAt)` to the `and(...)`)
- Modify: `apps/core/src/services/reports-list-service.ts` (`listForModality`: the run-table query for `audit` and `watcher` adds `isNull(table.archivedAt)`; `phantom_demand` has no column — branch on modality)
- Modify: `apps/core/src/services/audit-report-service.ts:465-480` (`listRecentExceptions`: add `isNull(auditRunsTable.archivedAt)` to its where)
- Test: `apps/core/src/services/__tests__/archived-runs-hidden-from-readers.test.ts`

- [ ] **Step 1: Failing test** — for each reader, insert one active and one archived run for the caller (watcher for the feed with `status: 'complete'`, `completedAt` set and the order-promise signal type the feed filters on — read the feed's `where` to copy the exact signal-type predicate; audit runs for reports-list and recent-exceptions with a result row where required), call the reader, and assert the archived run's id is absent while the active one is present. Three `it` blocks, one per reader, named `feed()`, `listForModality('watcher')`/`('audit')`, `listRecentExceptions()`. Construct the services with their real constructors (`new OrderPromiseFeedService(db)`, etc.; read each constructor's parameters and satisfy them with the same stubs the neighbouring tests use).

- [ ] **Step 2: Run — must fail (archived ids present)**

- [ ] **Step 3: Implement** the three `isNull(...archivedAt)` conditions with a one-line dated comment each: `// v1.85 (D-206): archived runs are off every rollup by default.`

- [ ] **Step 4: Green + the three readers' existing test files + commit**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run src/services/__tests__/archived-runs-hidden-from-readers.test.ts src/services/__tests__/order-promise-feed-service.test.ts src/services/__tests__/reports-list-service.test.ts src/services/__tests__/audit-report-service.test.ts --maxWorkers=2 --minWorkers=1
cd /Users/samfleming/dev/hw/haiCore-v185 && git add apps/core/src/services && git commit -m "feat(sonar): rollup readers exclude archived runs (D-206)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(If a listed existing test file does not exist under that name, run whichever test file covers that service — `ls apps/core/src/services/__tests__ | grep <service>`.)

---

### Task 8: D-206 register row and v1.52 revision row

**Files:**
- Modify: `docs/security/security-compliance.md` — the decisions table (D-206 row directly after the D-205 row at line ~334) and `## 7. Revision history` (v1.52 row directly above v1.51 at line ~414).

- [ ] **Step 1: Read D-205's row and the v1.51 row verbatim** (`sed -n '334p;414p' docs/security/security-compliance.md`) and keep the same column order: `| **D-2xx** | decision statement + mechanism | owner's words + why + disclosure + trade-off | Built — … | date |`. Escape any `|` inside cells as `\|`.

- [ ] **Step 2: Write the D-206 row** (one line; the cells' content is the primary source — this repo's code as of this branch):

Column 2: `**Deleting a Sonar definition asks what happens to its prior runs; audits always archive; archived runs are hidden everywhere by default, viewable by filter, never deleted.** \`RunTemplateService.delete(participantId, templateId, { runs })\` (\`apps/core/src/services/run-template-service.ts\`) applies one of delete / archive / keep to the class's run table inside the same transaction that removes the template row: archive stamps \`archived_at\` and \`template_name_snapshot\`, keep stamps only the name, delete removes the rows (children cascade). An audit template refuses delete and keep (400 \`AUDIT_RUNS_ARCHIVE_ONLY\`); a watcher template defaults to keep; any running run blocks delete and archive (409 \`RUNS_IN_FLIGHT\`). \`WatcherRunService.list\` / \`AuditRunService.list\` and the order-promise feed, reports list and recent-exceptions readers add \`archived_at IS NULL\`; \`?archived=true\` on the two list routes inverts it. Migration 0046; protocol 3.80.0 (\`archived_at\` on both run envelopes, \`RunsDispositionSchema\`, \`RunTemplateDeleteResponseSchema\`); \`watcher_snapshots.template_id\` now SET NULL on template delete so archived and kept runs keep their drift history.`

Column 3: `Owner (2026-09-02, HaiWeb console walk): "under the delete button, we need to offer an option to delete prior runs, archive prior runs, keep runs in active history"; "archived runs disappear from the primary Runs list and dashboards but stay viewable through an Archived filter on that list, and are never deleted"; "as these are audits it is always archive - never delete, its not an option". Why server-side: the audit rule is a compliance stance, not a UI preference, so the API refuses the other dispositions regardless of caller. Disclosure: nothing new crosses a counterparty boundary — the only data copied is the caller's own template name onto the caller's own runs. Trade-off accepted: a deleted template's runs lose their live join and rely on the snapshot name; the daily retention job's inner join already leaves runs of a deleted template alone, so "never deleted" holds without a new exemption. Deferred (§L): phantom-demand disposition; per-run archive/unarchive.`

Column 4: `Built — haiCore v1.85 PR 2 (this branch \`v1.85-run-disposition\`; merge sha and deploy recorded here at deploy). HaiWeb side follows in HaiWeb PR 2.`

Column 5: `2026-09-02`

- [ ] **Step 3: Write the v1.52 revision row** above v1.51:

`| v1.52 | 2026-09-02 | **D-206 added (haiCore v1.85 PR 2, branch \`v1.85-run-disposition\`; migration 0046; protocol 3.80.0):** deleting a Sonar definition applies a run disposition — delete / archive / keep for watchers, archive only for audits; archived runs are hidden from every list and rollup by default, listed by \`?archived=true\`, never deleted; kept and archived runs keep the definition's name by snapshot; watcher drift snapshots survive a template delete. Numbers allocated by agent1 2026-09-02; row authored by hw-03 on the branch, cites to be verified at merge. |`

- [ ] **Step 4: Check the table still renders** (`grep -c '^| \*\*D-' docs/security/security-compliance.md` increases by one; no unescaped `|` inside the new cells) and commit:

```bash
cd /Users/samfleming/dev/hw/haiCore-v185 && git add docs/security/security-compliance.md && git commit -m "docs(security): D-206 run disposition on definition delete; register v1.52

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
Report: "D-206 + v1.52 WRITTEN".

---

### Task 9: Binding gate, PR

- [ ] **Step 1: Builds (per package, root)**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185 && npm run build
```
Expected: exit 0 (protocol then core).

- [ ] **Step 2: Full haiCore test gate on the lane DB, per package, serialized**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185/packages/protocol && npx vitest run --maxWorkers=3 --minWorkers=1
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && DATABASE_URL=postgresql://haiwave:dev_password@localhost:5433/haiwave_v185_test npx vitest run --maxWorkers=3 --minWorkers=1
cd /Users/samfleming/dev/hw/haiCore-v185/apps/core && npm run typecheck:tests
```
Expected: 0 failed in both packages, no `(retry x` lines, typecheck exit 0. A red that passes alone is a flake to report, not a fix to make. Record the "Test Files / Tests" lines.

- [ ] **Step 3: Push and open the PR against `main`**

```bash
cd /Users/samfleming/dev/hw/haiCore-v185 && git push -u origin v1.85-run-disposition
```
PR title: `v1.85 PR 2 (haiCore) — run disposition on definition delete: delete/archive/keep, audits archive-only (D-206, 0046, protocol 3.80.0)`. Body: `## Summary` (the D-206 row's column 2 in prose), `## Test plan` (the gate lines from Step 2 and the migration apply log), and the line `Owner's rulings 2026-09-02; spec in HaiWeb docs/superpowers/specs/2026-09-02-run-disposition-on-delete-design.md`. Use `gh pr create --repo simmysam3/haiCore --base main --head v1.85-run-disposition --body-file <file>`; if the body must be edited later use `gh api -X PATCH repos/simmysam3/haiCore/pulls/<n> -F body=@<file>` (the `gh pr edit` path is broken on these repos).

---

### Task 10 (companion, separate PR on the same branch stack): audit template SKU narrowing

**Files:**
- Modify: `apps/core/src/services/audit-run-service.ts:156-159` (pass `skus`), `:207-270` (filter `resolved_products`), `:961-983` (`resolveCompanyProducts` gets an optional `skus` set)
- Test: `apps/core/src/services/__tests__/audit-run-template-sku-narrowing.test.ts`

**Interfaces:** the company trigger input gains `skus?: string[]`; when non-empty, `scope_snapshot.resolved_products` contains only those SKUs.

- [ ] **Step 1: Cut the branch** `git checkout -b v1.85-audit-sku-narrowing` from `v1.85-run-disposition` (after Task 9's push).

- [ ] **Step 2: Failing test** — mirror `audit-run-template-accepted-narrowing.test.ts` (read it first: it seeds an accepted scope with several products and triggers from a template). Seed a scope resolving to 5 product ids, a template whose `scope.skus` lists 2 of them, trigger via the template path, and assert `scope_snapshot.resolved_products` has exactly those 2 (vendor id + product id pairs). Second case: `skus: []` keeps all 5.

- [ ] **Step 3: Run — fails with 5 products.**

- [ ] **Step 4: Implement** — in the `'initiatorId' in input` branch, add `skus: scope.skus` to the `scopeType: 'company'` normalised input (type: add `skus?: string[]` to `AuditRunTriggerInput`'s company variant); in the company branch after `const resolved = await this.resolveCompanyProducts(scopeIds, input.auditorId);` add:
```ts
      // v1.85 (2026-09-02): a template's skus narrow the PRODUCTS, not only the
      // scopes — six configured SKUs used to audit a scope's whole catalog.
      const skuSet = input.skus && input.skus.length > 0 ? new Set(input.skus) : null;
      const narrowed = skuSet ? resolved.filter((r) => skuSet.has(r.product_id)) : resolved;
```
and use `narrowed` in the snapshot (`resolved_products: narrowed`). Keep `resolveTemplateScopeIds` as is (it still picks the scopes).

- [ ] **Step 5: Green, the audit-run service tests, build, commit, push, PR** `v1.85 PR 2b (haiCore) — audit template SKUs narrow the audited products` with base `v1.85-run-disposition` (retarget to `main` after PR 2 merges).

---

## Self-review (done by the author)
- Spec §2 rows → Tasks 3/4 (dispositions, defaults, 400/409), Task 5/6 (lists, coalesce), Task 7 (readers), Task 1 (snapshot FK), retention statement (documented in D-206 row, Task 8). Spec §3.4 → Task 2 incl. the §P deferral text. Spec §3.5 → Task 8. Spec §3.6 → Task 10. Delivery §6 step 1 → Task 9.
- Names used consistently: `delete(participantId, templateId, { runs })`, `RunsDisposition`, `RunTemplateDeleteResponse`, `archivedAt` / `templateNameSnapshot` (columns), `archived_at` (wire), `list(initiatorId, { archived })`, `ListRunsFilter.archived`.
- Known unknowns stated in-line rather than hidden: the FK constraint name (Step 4 of Task 1 says to read it), the route test helper names (Task 4), the union-typed drizzle update (Task 3 gives the fallback).
