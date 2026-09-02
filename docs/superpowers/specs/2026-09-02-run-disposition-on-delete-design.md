# Run disposition on definition delete — design (v1.85 PR 2)

**Status:** DRAFT for owner review · **Lane:** hw-03 (HaiWeb v1.85) · **Repos:** haiCore (+protocol) then HaiWeb, in that order.
**Counters (allocated by agent1 2026-09-02, unspent until this spec is approved):** PG migration **0046** · protocol **3.80.0** · decision **D-206** · register **v1.52**.

## 1. Problem and rulings

Deleting a Sonar definition (watcher or audit) today is a bare `DELETE FROM run_templates` (`haiCore apps/core/src/services/run-template-service.ts:267`). The run tables' `template_id` FKs are `ON DELETE SET NULL`, so every prior run silently survives with no name ("— Run a1b2c3d4" on the primary Runs list), and `watcher_snapshots.template_id` is `ON DELETE CASCADE`, so the lead-time drift history is erased while the runs are kept. The owner's walk of 2026-09-02 found 78 such orphaned watcher runs behind one live watcher.

Owner's rulings (2026-09-02):
- On delete, the user chooses what happens to prior runs: **delete**, **archive**, or **keep in active history**.
- **Archive** = the runs stay, disappear from the primary Runs lists and from dashboards, remain viewable through an **Archived** filter on those lists, and are **never deleted** by this feature.
- **Audits always archive.** Delete and keep are not options for audit definitions.
- Watchers get the three-way choice.

Out of scope (§L): phantom-demand definitions keep today's behaviour (runs kept, unnamed); grounded forecasts; retention-by-age policy.

## 2. Semantics

| disposition | run rows | `archived_at` | name after delete | on primary list | on dashboards | via Archived filter |
|---|---|---|---|---|---|---|
| delete (watcher only) | hard-deleted, children cascade | — | — | no | no | no |
| archive (audit always; watcher optional, **default**) | kept | `now()` | `template_name_snapshot` | no | no | yes |
| keep (watcher only; today's behaviour, now named) | kept | NULL | `template_name_snapshot` | yes | yes | no |

Rules:
- The disposition is decided and enforced **server-side**: an audit template rejects `runs=delete|keep` with 400 `AUDIT_RUNS_ARCHIVE_ONLY`; a watcher template with no `runs` param defaults to `keep` (backward compatible with today's wire behaviour).
- If any run of the template is `running` and the disposition is not `keep`, the delete is refused with 409 `RUNS_IN_FLIGHT { running_count }`. The user cancels or waits, then retries. (Archiving a running run would hide an in-flight run; deleting one would orphan the orchestrator — `watcher-run-service.deleteRun` already refuses it.)
- Archiving stamps `template_name_snapshot` on the runs **before** the template row is deleted (afterwards `template_id` is NULL and the name is unjoinable). Keep also stamps it, so kept runs stop appearing unnamed.
- Lists return `template_name = COALESCE(run_templates.template_name, template_name_snapshot)`.
- "Never deleted": the daily retention job (`scheduled-run-service.ts:263`) deletes by age through an inner join to `run_templates`, so runs of a deleted template are already immune; archived runs therefore survive it without new logic. Documented, not changed.

## 3. haiCore

### 3.1 Migration 0046 (`apps/core/drizzle/0046_run_archive_on_template_delete.sql`, hand-written; precedent `0042_agent_dispatch_failures.sql`)
- `watcher_runs`: `archived_at timestamptz NULL`, `template_name_snapshot text NULL`; partial index `(initiator_participant_id, triggered_at DESC) WHERE archived_at IS NULL`.
- `audit_runs`: same two columns and index.
- `watcher_snapshots.template_id` FK: `ON DELETE CASCADE` → `ON DELETE SET NULL` (column already nullable since 0041), so an archived or kept watcher run keeps its drift snapshots.
- Applied in dev with `npm run db:apply --workspace=apps/core -- status` then `-- migrate`, on the lane DB first.

### 3.2 Delete path
- Route `DELETE /sonar/templates/:template_id?runs=delete|archive|keep` (`routes/run-templates.ts:141`). Invalid value → 400. Response becomes `200 { deleted: true, runs: { disposition, affected } }` (was 204) so the UI can say "12 runs archived". HaiWeb is the only consumer (haiCore has no client-sdk; the client lives in HaiWeb `src/lib/haiwave-api.ts`).
- `RunTemplateService.delete(participantId, templateId, { runs? })`, one transaction: load template (404 if not owner's) → resolve disposition per §2 → count running runs in the class's run table, 409 if >0 and disposition ≠ keep → stamp `template_name_snapshot` → archive (`archived_at = now()`) or delete (row delete; `watcher_results`/`watcher_snapshots`/`audit_run_results` cascade on `run_id`) → delete the template row (events cascade as today) → return counts.
- Run tables by class: watcher → `watcher_runs`; audit → `audit_runs`; phantom_demand → untouched (§L).

### 3.3 Lists and readers (exclude archived by default)
- `GET /sonar/watcher/runs?archived=true|false` and `GET /source-audit/runs?archived=true|false` (default false). `WatcherRunService.list(initiatorId, { archived })`, `AuditRunService.list(initiatorId, { status, limit, archived })`: `archived_at IS NULL` by default; `archived=true` returns only archived rows. Both add the COALESCE for `template_name`.
- Readers that feed dashboards/rollups and must add `archived_at IS NULL` (from the census): `reports-list-service.listForModality`, `audit-report-service.listRecentExceptions`, `order-promise-feed-service.feed`. Already scoped to live templates, no change: `working-list-service.collectGaps`. Terminal-status-only readers (`usage-aggregator`, throttle counts), no change. Single-run readers (get/status/results/trailing history), no change: an archived run stays openable by id from the Archived view.

### 3.4 Protocol 3.80.0 (`packages/protocol/src`)
- `WatcherRunSchema`, `AuditRunSchema`: `archived_at: z.string().datetime().nullable().optional()` (additive).
- New `RunsDispositionSchema = z.enum(['delete','archive','keep'])`, `RunTemplateDeleteResponseSchema { deleted: true, runs: { disposition, affected: number } }`.
- Changelog entry: additive; and per agent1's docket condition, every parked §P item is **DEFERRED to 3.81.0**: scorer `unit_price: 0` · 'EA' UoM on the offering wire · catalog lead-time range · quantity-only promise cut · retry_config · order_records.status CHECK · PO/notes asymmetry · F-G1-1 basis/site on the wire · deep-link producer. None carried.

### 3.5 Decision record
- **D-206** register row in `docs/security/security-compliance.md`, in D-205's shape (row written from the primary source at PR time): archive semantics as in §1–§2, server-enforced audit rule, 409 on in-flight runs, name snapshot as the only data copied. Revision-history row **v1.52**.

### 3.6 Companion haiCore fix (separate PR on the same branch stack; found on the same walk)
`AuditRunService.resolveTemplateScopeIds` uses a template's `skus` only to pick accepted scopes; `resolveCompanyProducts` then audits every product of those scopes (6 configured SKUs → 30 audited). Fix: carry `skus` into the company trigger input and filter `resolved_products` to the SKU set when non-empty; test with a scope of 30 and a template of 6.

## 4. HaiWeb

- `src/lib/haiwave-api.ts`: `deleteRunTemplate(id, { runs? })` → `?runs=`; `listWatcherRuns`/`listAuditRuns` accept `archived`.
- BFF: `api/account/sonar/{watcher,audit}/definitions/[id]` DELETE and `api/account/sonar/templates/[id]` DELETE forward `?runs=`; `watcher/runs` and `audit/runs` GET forward `?archived=`.
- **Delete dialog** (shared `DefinitionEditor`, shipped as a plain dialog in PR 1): per modality —
  - watcher: radio group *Prior runs*: **Archive prior runs** (default) · Delete prior runs · Keep in active history, each with one line of consequence; confirm button "Delete watcher".
  - audit: statement "Its N runs will be archived. Archived runs stay viewable under Runs → Archived." No choice.
  - phantom demand: today's statement (runs kept).
  - 409 `RUNS_IN_FLIGHT` → form error "N runs are still running. Wait for them to finish or cancel them, then delete."
- **Archived filter**: an `Active | Archived` pill toggle above the Runs table on `/account/sonar/watchers`, `/account/sonar/audit`, and both definition pages' Run history tab; the toggle switches the SWR poll endpoint (`?archived=true`) and is reflected in the URL (`?runs=archived`). Archived rows carry a muted `archived` Pill (new `PILL_DEFINITIONS` entry). `RunHistoryTable` itself stays a table; the toggle is rendered by its callers.
- Dashboards: no HaiWeb change; they inherit haiCore's default exclusion. Verified by a test on the activity BFF that a run with `archived_at` set is absent from the feed only if haiCore omits it — i.e. HaiWeb does not re-filter.

## 5. Testing (red/green per behaviour)
- haiCore service: audit forced archive; watcher default keep; watcher delete/archive/keep each; running run → 409 for delete and archive, not keep; snapshot name stamped before template delete; lists exclude by default and `archived=true` inverts; COALESCE name; watcher snapshots survive a template delete. Route: 400 on bad value, 400 on audit + delete, 200 body shape. Migration: `-- status` then `-- migrate` on the lane DB, then the service tests against it.
- HaiWeb: dialog per modality (radios present only for watcher; audit copy; default archive); DELETE body carries `runs`; 409 copy; filter toggle changes the poll endpoint and URL; archived pill; BFF forwarding tests in the existing route-test style.
- Gates: per O-3, builds + affected tests per task; one binding full gate per PR on the exact merging tree (haiCore per package on the lane DB; HaiWeb `npm run build` + full vitest).

## 6. Delivery
1. haiCore PR from `~/dev/hw/haiCore-v185` (fresh worktree directly under `~/dev/hw`, cut from `main`): migration 0046, services, routes, protocol 3.80.0, D-206 + v1.52. Merge first.
2. Central must run the merged haiCore before the HaiWeb side is walkable on :3001 (Central pid 18541 runs from the primary checkout — agent1's runtime tree; deploy is coordinated with agent1, never a ff under the live pid).
3. HaiWeb PR 2 on `v1.85-run-disposition` (this branch), stacked on PR 3 (#163). The :3002 walk server needs `node_modules/@haiwave/protocol` repointed at the lane haiCore worktree's built protocol while haiCore is unmerged, then back to the primary after merge.
4. haiClient's vendored protocol sync to 3.80.0 is agent1's to schedule (additive fields; nothing in haiClient consumes them).

## 7. §L (deferred, not forgotten)
- Phantom-demand definitions: the same three-way choice (PD already has a disconnected by-template bulk delete, `phantom-demand-run-service.ts:577`).
- Retention-by-age for kept runs of a deleted template is already inert (inner join); a policy for archived runs of live templates is moot since archive only happens at delete.
- `grounded_forecast_runs.template_id` has no FK at all — a fourth, differently behaved run table.
- Per-run archive/unarchive from the run page (not asked for).
