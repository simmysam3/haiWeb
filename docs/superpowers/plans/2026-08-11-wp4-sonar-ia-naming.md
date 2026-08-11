# WP4 — Sonar IA + Naming Implementation Plan (v1.73 lane)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sonar's web IA legible as the two web surfaces of the three-surface model, unify the watcher page family under one name, and land the walk's four findings (#16 #18 #19 #22) plus adjacent defects in place — zero URL moves beyond retiring one orphan into a redirect.

**Architecture:** In-place evolution of haiWeb (Next.js 16 App Router, BFF pattern). Phase 1 is haiWeb-only on lane `v1.73` with no dependency on WP1/WP2/WP3 merges. Phase 2 is the severable Ruling-4 alias rider (protocol **3.67.0** + one haiCore serve-time mint), HARD-GATED behind WP3's 3.66.0 landing on haiCore `main` — if WP3 slips, Phase 1 ships alone.

**Tech Stack:** Next.js 16 / React / TypeScript strict, Tailwind v4, vitest (jsdom, retry: 2), Playwright (`e2e/walk.spec.ts`), `@haiwave/protocol` via `file:` symlink (currently 3.64.0).

**Spec:** `docs/superpowers/specs/2026-08-11-wp4-sonar-ia-naming-design.md` (approved; master `a3ddb1e`).

**Status:** PLAN APPROVED by owner 2026-08-11 — including the six-item deviations ledger below (its resolutions are ratified; do not re-ask them). Execution mode ruled: subagent-driven (superpowers:subagent-driven-development), fresh agent6 lane, the WP1/WP3 pattern. Phase 2 remains gated per Task 21 regardless.

## Global Constraints

- Lane **v1.73**. haiWeb default branch is **`master`**; the master-holder worktree is `~/dev/hw/haiWeb-v169-mrp` (plain `~/dev/hw/haiWeb` is PARKED at v1.66 — never work there).
- **Zero URL changes** except `/account/sonar/watcher/dashboard` → permanent redirect to `/account/sonar/watchers`.
- **Zero haiCore PG migrations** anywhere in this plan (Phase 2's alias is serve-time computed; nothing new is persisted).
- Protocol **3.67.0 is QUEUED BEHIND WP3's 3.66.0** — Phase 2 has a hard entry gate (Task 21) and never rides agent5's frozen mint. Phase 1 must merge cleanly with the symlinked protocol still at 3.64.0 **or** at 3.66.0 (both are verified by tests written here).
- **Protocol value-imports appear ONLY in test files.** Client (`'use client'`) and server modules alike use `import type` only. (Turbopack + CJS + `file:` symlink; the reason `pill.tsx`'s mirror and both `_lib/event-kind-pills.ts` files exist.)
- **Every new shared constant lives OUTSIDE `'use client'` modules** (a client-module const is an opaque client reference on the server — `new Set(arr)` throws; the `event-kind-pills` lesson).
- **House patterns:** every pill through `<Pill>` + a `PILL_DEFINITIONS` entry; drill-downs through `<DetailChevron expanded>`; BFF routes via `withHaiCore`; degraded lanes via `unwrapBestEffort`.
- Components with live `<details>` are tested by **presence, not visibility** (jsdom renders all `<details>` children regardless of `open`).
- **`walk.spec` updates are enumerated work** — every rename/retire step names its `e2e/walk.spec.ts` update in the same task.
- TDD red/green. **Named mutation per declared constraint** (each pin test's task states the mutation that must fail it).
- Gates per task: `npm run test` scoped to touched files, full `npm run build` + `npm run test` + `npm run lint` at phase end. vitest disposed after every task; ≤3 concurrent vitest across the machine; kill only this worktree's.
- Copy rules: plain, deliberate, human. Severity vocab `info | warning | critical`. Keep the typographic apostrophe in `ERP’s` where copy is mirrored; keep WP3's authored strings byte-exact.
- **File:line pins in this plan were verified at haiWeb `a3ddb1e` / haiCore origin/main `52277894` — RE-READ AT DISPATCH.** Phase 2 pins WILL have moved (WP3 lands first, by design). Numbers (protocol version literals, D-numbers) are re-grepped, never trusted from this document (both staleness failure modes are silent).
- Commits: conventional prefixes, explicit `git add <paths>` (never `-A`), one commit per green step. The implementer NEVER merges; Task 20/25 open PRs; owner walks and merges.
- D-numbers: any security-register row is allocated by the orchestrator (agent1) at write time after re-grepping the register tail (tail was D-154 at plan time; D-155/D-156 are WP1's, D-157 is WP3's — expect D-158+, but re-grep).

## Spec deviations discovered at extraction (owner: review these first)

The extraction pass (six verbatim extractors over haiWeb `a3ddb1e` + haiCore origin/main `52277894`) surfaced six places where the approved spec's premises don't match the code. The plan resolves each as follows:

1. **§3.2 server half — VERDICT: no haiCore gate relaxation is needed.** `resolveTemplateScopeIds` is `private` to `AuditRunService` with exactly one call site, reached only on `scope.kind === 'audit'` (`audit-run-service.ts:138-159`). Watcher template creation (`routes/run-templates.ts:56-72` → `RunTemplateService.create`, `run-template-service.ts:115-141`) is parse + insert with zero scope lookup; the watcher run-time gate is the trust class (`watcher-signal-service.ts` `REQUIREMENT` map — trading_pair-or-above). The accepted-audit-scope restriction the walk saw is **entirely haiWeb-side** (the picker's data source). §3.2 is therefore haiWeb-only (Task 13).
2. **§4 mint site — `nullSubtierIdentity` never touches watcher data.** Its two callers (`audit-run-service.ts:463`, `evidence-tree-service.ts:208`) both skip/never see watcher payloads; the watcher walk's identity-redaction boundary is `watcher-result-rows.ts:102`, and the shapes haiWeb renders are flat `WatcherResult` rows (which have no tree and no alias field). The rider therefore mints **serve-time on the watcher results read path**, keyed per `aggregated_under_tier_1` cluster, with `supplier_alias` added to `WatcherResultSchema` in 3.67.0 (Tasks 21–24). One central mint site, zero persistence, zero migrations — the spec's intent (central-minted, run-scoped, chip-promise-compatible) preserved on the surface Ruling 4 actually names. Audit-tree aliasing via `nullSubtierIdentity` is **deferred** (different surface; separate ruling if wanted).
3. **The orphan page's component subtree becomes unreachable and is deleted.** `WatcherDashboard`, `LatestSnapshot`, `RunHistory` (+ their tests) are mounted ONLY by `/account/sonar/watcher/dashboard/page.tsx` (grep-verified). With the redirect they are dead code, and dead code behind green tests is the recurring hazard. Consequences: §3.6's `watcher-dashboard.tsx:34/:39` and `run-history.tsx` sites are **deleted, not tightened**; §4's `latest-snapshot.tsx:171` alias call site is **vacated** (the grid remains the watcher alias surface).
4. **§4 mock gating already exists structurally.** `with-hai-core.ts` serves `fallback` only when `NODE_ENV !== "production"` (both the non-JWT and error paths); production degrades to 401/500, never to `MOCK_PARTNERS`. WP4 **pins** this with a named-mutation test (Task 15) instead of building it.
5. **"PILL_DEFINITIONS's watcher-status category" = the `run_status` category.** No `watcher_status` category exists; `run_status`'s six entries are exactly `WatcherRunStatus`'s six members (Task 10).
6. **Two more mis-routing sites found beyond the spec's three:** `usage/_components/active-runs-list.tsx:8-12` and `throttle-history-list.tsx:8-12` hand-roll the same audit→watchers mis-route AND send watcher `run_id`s to `templates/[id]` (which `notFound()`s an unresolvable id). Task 4 converges them on `runDetailHref` — severable; reject Task 4 alone if unwanted. (The spec's "must not break `templates/[id]` consumers" guarantee is about the route continuing to exist, which it does.)

**Dormancy verified safe:** haiCore's changes feed filters unknown `kind` values (`sonar-compliance-changes.ts`: `rawKinds.filter((k) => ComplianceChangeKindSchema.safeParse(k).success)` — "ignore unknown values"). Sending `upstream_risk_reported` at 3.64.0/3.65.0 is a server-side no-op; the kind lights up the day 3.66.0 deploys. No haiWeb runtime filtering needed.

---

## File structure (Phase 1)

| Unit | Files | Responsibility |
|---|---|---|
| Routing table | `templates/_lib/run-detail-href.ts` (+test), activity `route.ts` (+test), `watcher-signals-card.tsx`, usage `active-runs-list.tsx` / `throttle-history-list.tsx` | One mapping: run → its own detail page |
| Orphan retirement | `watcher/dashboard/page.tsx` → redirect; DELETE `watcher/dashboard/_components/**` | Retire the singular-watcher dashboard |
| Nav | `components/account-nav.tsx` (+test) | Two-surface Sonar section, one "Watchers" family |
| Run-status terminality | NEW `sonar/_lib/watcher-run-status.ts` (+test); consumers `watchers/[id]/page.tsx`, `use-run-status.ts`, `cross-modality/route.ts`; `pill.tsx`; `registration-detail.tsx` | Exhaustive status semantics; 7th member fails the build |
| Pill/copy integrity | `pill.tsx` (+2 tests), both `_lib/event-kind-pills.ts`, `_lib/describe-change.ts` (+test), NEW `sonar/__tests__/backlog-kind-partition.test.ts` | Mirror pinned to protocol; `upstream_risk_reported` forward-carried |
| Signal panels | NEW `order-promise-schedule-panel.tsx`, `order-fulfillment-history-panel.tsx`, `soft-quoted-lead-time-panel.tsx` (+tests); `counterparties-grid.tsx` (+tests) | Every scoring signal has a visible panel |
| Identity three-state | `counterparties-grid.tsx`; NEW `__tests__/partners-route-prod-gate.test.ts` | redacted (wire flag) / unresolved / mock — never conflated |
| Wizard picker | `bilateral-counterparties-skus-fields.tsx` (+test), `watcher-scope-picker.tsx` | `universe` prop: audit unchanged, watcher = trading pairs |
| Heartbeat alert | `dashboard-alert-bar.tsx` (+test), `account/page.tsx` | Names jailed agents; links somewhere real |
| Backlog filters | `posture/changes/filter-pills.tsx` (+test) | Two-row layout; partner name-select |

---

### Task 1: Worktree, baseline gate floor, allocation re-verification

**Files:**
- Create: worktree `~/dev/hw/haiWeb-v173-wp4` (branch `v1.73-wp4` off `master`)

**Interfaces:**
- Produces: a clean worktree at haiWeb master tip with working `node_modules` (protocol symlink → the haiCore **main-holder** `haiCore-v166-agent2`, version 3.64.0 or later-minor) and a recorded green baseline every later task is measured against.

- [ ] **Step 1: Create the worktree off the master-holder**

```bash
cd ~/dev/hw/haiWeb-v169-mrp && git fetch origin
git worktree add ../haiWeb-v173-wp4 -b v1.73-wp4 origin/master
```

- [ ] **Step 2: Clone node_modules from the lockfile-identical sibling (do NOT npm install)**

A fresh `npm install` re-resolves `"@haiwave/protocol": "file:../haiCore/packages/protocol"` against the PARKED v1.66 primary checkout — wrong protocol. APFS-clone the sibling's tree instead:

```bash
cp -c -R ~/dev/hw/haiWeb-v169-mrp/node_modules ~/dev/hw/haiWeb-v173-wp4/node_modules
readlink ~/dev/hw/haiWeb-v173-wp4/node_modules/@haiwave/protocol
# expect: .../haiCore-v166-agent2/packages/protocol
grep '"version"' ~/dev/hw/haiWeb-v173-wp4/node_modules/@haiwave/protocol/package.json
# expect: 3.64.0 (or 3.66.0 if WP3 landed and the main-holder moved — both fine for Phase 1)
```

- [ ] **Step 3: Record the baseline gate floor**

```bash
cd ~/dev/hw/haiWeb-v173-wp4
npm run build && npm run test && npm run lint
```

All three must be green BEFORE any change; record the vitest file/test counts in the SDD ledger. If the baseline is red, STOP and report — do not fix pre-existing breakage inside this lane.

- [ ] **Step 4: Commit ledger note only if your SDD workflow tracks it (no source changes in this task)**

---

### Task 2: Routing table — `runDetailHref` routes both run types to their own pages

**Files:**
- Modify: `src/app/account/sonar/templates/_lib/run-detail-href.ts` (28 lines, whole file below)
- Test: `src/app/account/sonar/templates/_lib/__tests__/run-detail-href.test.ts`

**Interfaces:**
- Produces: `runDetailHref(klass: 'audit' | 'watcher' | 'phantom_demand' | 'grounded_forecast', runId: string): string` with `audit → /account/sonar/audit/${runId}` and `watcher → /account/sonar/watchers/${runId}`. Tasks 3 and 4 import this exact function (it is a plain module — no `'use client'`; importable from server routes and client components alike).
- Consumes: nothing.

Background: the file's own docblock ("no dedicated audit run page exists yet… Watcher has no per-run detail page") is stale — `src/app/account/sonar/audit/[run_id]/page.tsx` and `src/app/account/sonar/watchers/[id]/page.tsx` both exist (verified at `a3ddb1e`).

- [ ] **Step 1: Write the failing test** — replace the stale pins in `run-detail-href.test.ts` (line 16 currently pins `watcher → /account/sonar/watcher/dashboard`) with the correct mapping covering BOTH run types (spec §6):

```ts
  it('routes audit runs to the audit run detail page', () => {
    expect(runDetailHref('audit', 'run-1')).toBe('/account/sonar/audit/run-1');
  });
  it('routes watcher runs to the watcher run detail page', () => {
    expect(runDetailHref('watcher', 'run-1')).toBe('/account/sonar/watchers/run-1');
  });
  it('routes phantom demand runs to the PD run page (unchanged)', () => {
    expect(runDetailHref('phantom_demand', 'run-1')).toBe('/account/sonar/phantom-demand/runs/run-1');
  });
  it('routes grounded forecasts to the forecast list (no per-run page by design)', () => {
    expect(runDetailHref('grounded_forecast', 'run-1')).toBe('/account/sonar/grounded-forecasts');
  });
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- run-detail-href` → the audit and watcher assertions FAIL against the current mapping.

- [ ] **Step 3: Implement** — new mapping + honest comment:

```ts
type ObservationClass =
  | 'audit'
  | 'watcher'
  | 'phantom_demand'
  | 'grounded_forecast';

/**
 * Where a "run detail" link for a triggered run should point, per modality.
 *
 * v1.73 WP4: audit and watcher runs each route to their OWN detail page —
 * /account/sonar/audit/[run_id] and /account/sonar/watchers/[id] both exist.
 * (This file's previous comment claimed neither did; that was stale, and the
 * audit→watchers mapping it justified sent users to the wrong run.)
 * Grounded forecasts store only the latest result keyed by template, not by
 * run, so there is nothing to address per run: the link lands on the list.
 */
export function runDetailHref(klass: ObservationClass, runId: string): string {
  switch (klass) {
    case 'audit':
      return `/account/sonar/audit/${runId}`;
    case 'phantom_demand':
      return `/account/sonar/phantom-demand/runs/${runId}`;
    case 'watcher':
      return `/account/sonar/watchers/${runId}`;
    case 'grounded_forecast':
      return `/account/sonar/grounded-forecasts`;
  }
}
```

- [ ] **Step 4: Run green** — `npm run test -- run-detail-href`
- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/templates/_lib/run-detail-href.ts src/app/account/sonar/templates/_lib/__tests__/run-detail-href.test.ts
git commit -m "fix(sonar): runDetailHref routes audit and watcher runs to their own detail pages"
```

---

### Task 3: Activity feed `detail_href` — clicking a run lands on THAT run

**Files:**
- Modify: `src/app/api/account/sonar/dashboard/activity/route.ts` (three literal hrefs at ~:155, ~:174, ~:199)
- Test: `src/app/api/account/sonar/dashboard/activity/__tests__/route.test.ts` (stale pin at :64)

**Interfaces:**
- Consumes: `runDetailHref` from Task 2 (`@/app/account/sonar/templates/_lib/run-detail-href`).

- [ ] **Step 1: Write the failing test** — in `route.test.ts`, replace the line-64 pin (`expect(body.events[1].detail_href).toBe('/account/sonar/watcher/dashboard')`) and add the audit pin:

```ts
    expect(body.events[0].detail_href).toBe(`/account/sonar/audit/${AUDIT_RUN_ID}`);
    expect(body.events[1].detail_href).toBe(`/account/sonar/watchers/${WATCHER_RUN_ID}`);
```

(Use the run-id constants the existing test fixtures already define — re-read the fixture names at dispatch; the shape is events[0]=audit, events[1]=watcher per the existing test's ordering.)

- [ ] **Step 2: Run red** — `npm run test -- dashboard/activity`
- [ ] **Step 3: Implement** — import once and use it for all three mapped arrays:

```ts
import { runDetailHref } from '@/app/account/sonar/templates/_lib/run-detail-href';
```

- audit events: `detail_href: runDetailHref('audit', r.run_id),`
- watcher events: `detail_href: runDetailHref('watcher', r.run_id),`
- pd events: `detail_href: runDetailHref('phantom_demand', r.run_id),`

- [ ] **Step 4: Run green** — same scope.
- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/sonar/dashboard/activity/route.ts src/app/api/account/sonar/dashboard/activity/__tests__/route.test.ts
git commit -m "fix(sonar): activity feed detail_href lands on the clicked run for all modalities"
```

---

### Task 4: Usage lists converge on `runDetailHref` (severable)

**Files:**
- Modify: `src/app/account/usage/_components/active-runs-list.tsx:8-12`, `src/app/account/usage/_components/throttle-history-list.tsx:8-12`
- Test: `src/app/account/usage/_components/__tests__/run-href.test.tsx` (new)

**Interfaces:**
- Consumes: `runDetailHref` (Task 2).

Both files hand-roll `RUN_HREF` maps that (a) mis-route audit runs to `/account/sonar/watchers/${id}` and (b) send watcher `run_id`s to `/account/sonar/templates/${id}` — a template route that `notFound()`s a run id. Converging on the shared table fixes both. This task is deliberately severable — rejecting it leaves Tasks 2–3 intact.

- [ ] **Step 1: Write the failing test** (new file):

```tsx
import { describe, it, expect } from 'vitest';
import { runDetailHref } from '@/app/account/sonar/templates/_lib/run-detail-href';

// The usage lists must not hand-roll run hrefs: grep-level pin plus behavior.
// (vitest runs ESM — no __dirname; resolve relative to this module's URL.)
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

describe('usage lists route runs through the shared routing table', () => {
  for (const file of ['active-runs-list.tsx', 'throttle-history-list.tsx']) {
    it(`${file} imports runDetailHref and defines no local RUN_HREF map`, () => {
      const src = fs.readFileSync(
        fileURLToPath(new URL(`../${file}`, import.meta.url)),
        'utf8',
      );
      expect(src).toContain("from '@/app/account/sonar/templates/_lib/run-detail-href'");
      expect(src).not.toContain('RUN_HREF');
    });
  }
  it('watcher run ids land on the watcher run page, not templates', () => {
    expect(runDetailHref('watcher', 'r1')).toBe('/account/sonar/watchers/r1');
  });
});
```

- [ ] **Step 2: Run red** — `npm run test -- usage`
- [ ] **Step 3: Implement** — in both components delete the local `RUN_HREF` const and replace its call sites (`RUN_HREF[r.observation_class](r.run_id)`) with `runDetailHref(r.observation_class, r.run_id)`; add the import. `ActiveRunRow['observation_class']` and `runDetailHref`'s union must line up — if the row type includes `grounded_forecast` this compiles as-is; if it is narrower, TypeScript accepts the narrowing without casts.
- [ ] **Step 4: Run green**, plus render tests already covering these components if any (re-check `usage/_components/__tests__/` at dispatch).
- [ ] **Step 5: Commit**

```bash
git add src/app/account/usage/_components/active-runs-list.tsx src/app/account/usage/_components/throttle-history-list.tsx src/app/account/usage/_components/__tests__/run-href.test.tsx
git commit -m "fix(usage): active/throttled run lists use the shared run routing table"
```

---

### Task 5: `WatcherSignalsCard` links to the Watchers list

**Files:**
- Modify: `src/app/account/sonar/dashboard/_components/watcher-signals-card.tsx:20`
- Test: `src/app/account/sonar/dashboard/_components/__tests__/watcher-signals-card.test.tsx` (create if absent — re-check at dispatch)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WatcherSignalsCard } from '../watcher-signals-card';

describe('WatcherSignalsCard', () => {
  it('View details links to the Watchers list, not the retired orphan dashboard', () => {
    render(
      <WatcherSignalsCard
        capacityBandCounts={{ low: 1, moderate: 0, high: 0, at_capacity: 0 }}
        medianLeadTimeP90={4}
      />,
    );
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/account/sonar/watchers',
    );
  });
});
```

- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement** — line 20: `href="/account/sonar/watchers"`.
- [ ] **Step 4: Run green.**
- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/dashboard/_components/watcher-signals-card.tsx src/app/account/sonar/dashboard/_components/__tests__/watcher-signals-card.test.tsx
git commit -m "fix(sonar): watcher signals card links to the Watchers list"
```

---

### Task 6: Retire the orphan `/account/sonar/watcher/dashboard` into a permanent redirect; delete its dead subtree

**Files:**
- Modify: `src/app/account/sonar/watcher/dashboard/page.tsx` (becomes a redirect)
- Delete: `src/app/account/sonar/watcher/dashboard/_components/**` (including `watcher-dashboard.tsx`, `latest-snapshot.tsx`, `run-history.tsx`, `per-counterparty-detail.tsx` if present, and `__tests__/**`)
- Test (e2e): `e2e/walk.spec.ts:124-128` (test 1.6) and `:221-236` (§6)

**Interfaces:**
- Consumes: Tasks 2, 3, 5 must be merged into the branch first — they remove every live link INTO the orphan URL.
- Produces: `/account/sonar/watcher/dashboard` → 308 → `/account/sonar/watchers`. The deleted components must have zero remaining importers.

Deviation note (owner-visible): the deleted subtree is exclusively mounted by this page (grep-verified at `a3ddb1e`); keeping it would leave dead components behind green tests. Its run-history role is served by the Watchers list history column pack; its per-counterparty snapshot role by the run detail grid.

- [ ] **Step 1: Update the e2e pins first** (red against current code is not observable without a stack; these are enumerated updates, run in the walk):

Replace test 1.6 (lines 124-128) with:

```ts
  test("1.6 legacy watcher dashboard permanently redirects to the Watchers list", async ({ playwright }) => {
    const req = await playwright.request.newContext({ baseURL: HAIWEB });
    const res = await req.get("/account/sonar/watcher/dashboard", { maxRedirects: 0 });
    expect(res.status(), "expected 308").toBe(308);
    expect(res.headers()["location"]).toContain("/account/sonar/watchers");
    await req.dispose();
  });
```

Replace §6 test 6.1 (lines 222-226) with:

```ts
  test("6.1 /account/sonar/watcher/dashboard redirects to /account/sonar/watchers (v1.73 WP4)", async ({ browser }) => {
    const page = await loggedInPage(browser);
    await gotoOk(page, "/account/sonar/watcher/dashboard"); // follows the 308
    await expect(page.locator("h1", { hasText: "Watchers" })).toBeVisible();
  });
```

Test 6.1b (type2) stays unchanged.

- [ ] **Step 2: Grep for remaining importers before deleting** (must be empty after Tasks 2/3/5):

```bash
grep -rn "watcher/dashboard/_components\|watcher-dashboard'\|latest-snapshot'\|run-history'" src | grep -v "watcher/dashboard/"
grep -rn "/account/sonar/watcher/dashboard" src e2e | grep -v "requests/decline-dialog.tsx"  # comment-only mention stays
```

Both must return nothing (except this task's own page file before Step 3).

- [ ] **Step 3: Implement the redirect** — replace `page.tsx` entirely:

```tsx
import { permanentRedirect } from 'next/navigation';

/**
 * v1.73 WP4: the singular "Watcher — Continuous observation" dashboard is
 * retired. Its run-history role is served by the Watchers list's history
 * column pack; per-counterparty snapshots live on each run's detail page.
 * Permanent (308) so bookmarks and any external links converge on the live
 * surface. The plural /account/sonar/watchers family is the only watcher home.
 */
export default function LegacyWatcherDashboardRedirect() {
  permanentRedirect('/account/sonar/watchers');
}
```

Delete the subtree:

```bash
git rm -r src/app/account/sonar/watcher/dashboard/_components
```

- [ ] **Step 4: Run the full unit gate** — `npm run test` (the deleted tests leave the count lower than baseline: record the delta and its reason in the ledger; nothing else may go red) and `npm run build` (catches any importer the grep missed).
- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/watcher/dashboard/page.tsx e2e/walk.spec.ts
git commit -m "feat(sonar): retire orphan watcher dashboard into a 308 to the Watchers list; drop its dead subtree"
```

---

### Task 7: Nav — the Sonar section reads as the two web surfaces

**Files:**
- Modify: `src/components/account-nav.tsx:105-156`
- Test: `src/components/__tests__/account-nav.test.tsx` (pins at :57-58, :67-68)

`e2e/walk.spec.ts` has ZERO pins on "Watcher Management" / nav labels (verified) — no e2e update in this task.

- [ ] **Step 1: Write the failing tests** — in `account-nav.test.tsx`, replace the `Watcher Management` pin (lines ~67-68) and add ordering + placement pins:

```tsx
  it('Sonar section: Dashboard · Phantom Demand · Watchers · Watcher Backlog · Grounded Forecasts · Request Management', () => {
    render(<AccountNav {...defaultProps} />);
    expect(screen.getByRole('link', { name: 'Watchers' })).toHaveAttribute(
      'href',
      '/account/sonar/watchers',
    );
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/account/sonar/dashboard',
    );
    // One name family: "Watcher Management" is gone.
    expect(screen.queryByRole('link', { name: 'Watcher Management' })).toBeNull();
    // Sonar Dashboard no longer lives in Account Management under that label.
    expect(screen.queryByRole('link', { name: 'Sonar Dashboard' })).toBeNull();
    // System Dashboard stays put.
    expect(screen.getByRole('link', { name: 'System Dashboard' })).toHaveAttribute('href', '/account');
  });
```

(Keep the existing `Watcher Backlog` pin at :57-58 as-is — label and URL are unchanged. Match the file's existing render/props idiom at dispatch.)

- [ ] **Step 2: Run red** — `npm run test -- account-nav`
- [ ] **Step 3: Implement** — in the `Sonar Observe` section (keep the section label and subhead):
  1. Insert as FIRST item: `{ href: "/account/sonar/dashboard", label: "Dashboard", tooltip: "Unified view across audits, watchers, phantom demand, and templates." }` (tooltip carried verbatim from the old entry).
  2. Reorder so items read: Dashboard · Phantom Demand (`/account/sonar/observations`) · Watchers · Watcher Backlog · Grounded Forecasts · Request Management.
  3. Rename `label: "Watcher Management"` → `label: "Watchers"` (href/tooltip unchanged).
  4. Remove the `{ href: "/account/sonar/dashboard", label: "Sonar Dashboard", ... }` entry from Account Management.
  5. Refresh the stale v.1.43 section comment: the watcher-side kinds are now the LT pair + promise-drift pair (+ `upstream_risk_reported` once 3.66.0 lands — Task 12); note the v1.73 WP4 re-order ("two-surface Sonar nav; Dashboard moved in from Account Management; nav says nothing about surface 3 — the agent console — per Ruling 2, 2026-08-10").
  6. Update the Watcher Backlog nav `tooltip` to cover promise drift: `"Drift events from your scheduled watcher configurations — lead-time and order-promise degradations and improvements detected across the supplier network."`
- [ ] **Step 4: Run green** — `npm run test -- account-nav` and `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add src/components/account-nav.tsx src/components/__tests__/account-nav.test.tsx
git commit -m "feat(nav): two-surface Sonar section — Dashboard moves in, Watcher Management becomes Watchers"
```

---

### Task 8: `watcher-run-status` traits module — terminality the compiler enforces

**Files:**
- Create: `src/app/account/sonar/_lib/watcher-run-status.ts`
- Test: `src/app/account/sonar/_lib/__tests__/watcher-run-status.test.ts`

**Interfaces:**
- Produces: `isTerminal(s: WatcherRunStatus): boolean`, `isUsableRun(s: WatcherRunStatus): boolean`. Plain module (NOT `'use client'`) — importable from server routes (Task 9's `cross-modality/route.ts`) and client components alike. Task 9 consumes both functions; Task 10 mirrors the exhaustiveness idiom.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
// TEST files may value-import the protocol package (client components may not).
import { WatcherRunStatusSchema } from '@haiwave/protocol';
import { isTerminal, isUsableRun, STATUS_TRAITS } from '../watcher-run-status';

describe('watcher-run-status traits', () => {
  it('covers every protocol WatcherRunStatus member (exhaustiveness gate)', () => {
    // Named mutation: add a 7th member to WatcherRunStatusSchema without a
    // traits row → the Record fails the BUILD; this test additionally fails
    // at runtime if the schemas drift the other way.
    expect(Object.keys(STATUS_TRAITS).sort()).toEqual(
      [...WatcherRunStatusSchema.options].sort(),
    );
  });
  it('terminal = complete/partial/failed/cancelled', () => {
    expect(isTerminal('complete')).toBe(true);
    expect(isTerminal('partial')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('running')).toBe(false);
    expect(isTerminal('throttled')).toBe(false);
  });
  it('usable = complete/partial only', () => {
    expect(isUsableRun('complete')).toBe(true);
    expect(isUsableRun('partial')).toBe(true);
    for (const s of ['running', 'throttled', 'failed', 'cancelled'] as const) {
      expect(isUsableRun(s)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run red** — module doesn't exist.
- [ ] **Step 3: Implement**

```ts
import type { WatcherRunStatus } from '@haiwave/protocol';

/**
 * Status semantics in ONE exhaustive table. This is a Record over the full
 * protocol union deliberately: when a 7th WatcherRunStatus member is minted,
 * this file fails the BUILD instead of a comparison chain silently
 * mis-rendering it (v1.73 WP4 §3.6). Type-import only — client components
 * may never value-import @haiwave/protocol (Turbopack + CJS + file: symlink).
 *
 *   terminal — the run will not change again on its own ('throttled' is NOT
 *              terminal: it resumes automatically when budget refreshes).
 *   usable   — the run produced results a reader may consume
 *              (complete or partial; failed/cancelled runs may carry partial
 *              rows but are not presented as a usable latest run).
 */
export const STATUS_TRAITS: Record<
  WatcherRunStatus,
  { terminal: boolean; usable: boolean }
> = {
  running: { terminal: false, usable: false },
  throttled: { terminal: false, usable: false },
  complete: { terminal: true, usable: true },
  partial: { terminal: true, usable: true },
  failed: { terminal: true, usable: false },
  cancelled: { terminal: true, usable: false },
};

export function isTerminal(status: WatcherRunStatus): boolean {
  return STATUS_TRAITS[status].terminal;
}

export function isUsableRun(status: WatcherRunStatus): boolean {
  return STATUS_TRAITS[status].usable;
}
```

- [ ] **Step 4: Run green.**
- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/_lib/watcher-run-status.ts src/app/account/sonar/_lib/__tests__/watcher-run-status.test.ts
git commit -m "feat(sonar): exhaustive WatcherRunStatus traits table (isTerminal/isUsableRun)"
```

---

### Task 9: Convert the surviving comparison-chain sites

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/page.tsx:155-169`, `src/app/account/sonar/watchers/[id]/use-run-status.ts:7`, `src/app/api/account/sonar/dashboard/cross-modality/route.ts:57-67`, `src/app/account/admin/registrations/[id]/registration-detail.tsx:40-47`

**Interfaces:**
- Consumes: `isTerminal` / `isUsableRun` (Task 8); `RegistrationStatus` (type) from `@/lib/registration-types`.

Scope note (deviation 3): the spec's `watcher-dashboard.tsx:34/:39` and `run-history.tsx` sites were deleted in Task 6. The `load-audit-charts.ts:46` allowlist operates on AUDIT run rows (a different status source) and is deliberately out of scope — note it in the ledger, don't touch it.

- [ ] **Step 1: Failing behavior pins** — extend `__tests__/watcher-run-status.test.ts`:

```ts
  it('failure banner set = terminal AND not usable (failed/cancelled exactly)', () => {
    const bannerSet = WatcherRunStatusSchema.options.filter(
      (s) => isTerminal(s) && !isUsableRun(s),
    );
    expect(bannerSet.sort()).toEqual(['cancelled', 'failed']);
  });
```

And a registration terminality test beside the component, `src/app/account/admin/registrations/[id]/__tests__/registration-terminal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RegistrationStatusSchema } from '@haiwave/protocol';
import { REGISTRATION_TERMINAL } from '../registration-terminal';

describe('registration terminality', () => {
  it('covers every RegistrationStatus member', () => {
    expect(Object.keys(REGISTRATION_TERMINAL).sort()).toEqual(
      [...RegistrationStatusSchema.options].sort(),
    );
  });
  it('only pending_approval is non-terminal', () => {
    expect(REGISTRATION_TERMINAL.pending_approval).toBe(false);
    expect(REGISTRATION_TERMINAL.approved).toBe(true);
    expect(REGISTRATION_TERMINAL.rejected).toBe(true);
  });
});
```

- [ ] **Step 2: Run red** (registration module missing).
- [ ] **Step 3: Implement**

New `src/app/account/admin/registrations/[id]/registration-terminal.ts` (plain module, no `'use client'`):

```ts
import type { RegistrationStatus } from '@/lib/registration-types';

// Exhaustive on purpose: a 4th RegistrationStatus member fails the build here
// instead of silently passing the old `status !== 'pending_approval'` chain.
export const REGISTRATION_TERMINAL: Record<RegistrationStatus, boolean> = {
  pending_approval: false,
  approved: true,
  rejected: true,
};
```

Site conversions:
- `registration-detail.tsx:47`: `const terminal = REGISTRATION_TERMINAL[status];` (+ import).
- `watchers/[id]/page.tsx` failure banner: replace `{(run.status === 'failed' || run.status === 'cancelled') && (` with `{isTerminal(run.status) && !isUsableRun(run.status) && (` (+ import from `@/app/account/sonar/_lib/watcher-run-status`). The `run.status === 'throttled'` branch above it is a status-specific banner, not a terminality chain — leave it.
- `use-run-status.ts:7`: delete `export const TERMINAL: WatcherRunStatus[] = [...]` and replace its membership checks with `isTerminal(status)` (re-read the hook's body at dispatch; if `TERMINAL` is exported and consumed elsewhere, grep first and convert those consumers in the same step).
- `cross-modality/route.ts:63`: `const usable = runs.filter((r) => isUsableRun(r.status));` (+ import — this is a server route importing the plain `_lib` module: allowed, that's why Task 8 kept it out of `'use client'`).

- [ ] **Step 4: Run green** — `npm run test` for the four touched areas + `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/watchers/\[id\]/page.tsx src/app/account/sonar/watchers/\[id\]/use-run-status.ts src/app/api/account/sonar/dashboard/cross-modality/route.ts src/app/account/admin/registrations/\[id\]/registration-detail.tsx src/app/account/admin/registrations/\[id\]/registration-terminal.ts src/app/account/admin/registrations/\[id\]/__tests__/registration-terminal.test.ts src/app/account/sonar/_lib/__tests__/watcher-run-status.test.ts
git commit -m "refactor(sonar): status comparison chains move to exhaustive terminality helpers"
```

---

### Task 10: `pill.tsx` — `run_status` category typed against the protocol union

**Files:**
- Modify: `src/components/pill.tsx:18-25` (the `run_status` block) and the `PILL_DEFINITIONS` declaration (:5)
- Test: `src/components/__tests__/pill.test.tsx`

Deviation 5: this IS the spec's "watcher-status category". The six current entries exactly match `WatcherRunStatus`.

- [ ] **Step 1: Write the failing test** — add to `pill.test.tsx` (retry-immune `definitionFor` idiom — never assert on console.warn absence, the `_warnedKeys` Set poisons retries):

```tsx
import { WatcherRunStatusSchema } from '@haiwave/protocol'; // TEST value-import: allowed

  it('run_status has a definition for every WatcherRunStatus member (retry-immune)', () => {
    for (const s of WatcherRunStatusSchema.options) {
      expect(definitionFor('run_status', s), `missing run_status definition: ${s}`).toBeDefined();
    }
  });
```

- [ ] **Step 2: Run red only if a member is missing** — expected GREEN today (all six exist); the red half of this cycle is the compile-time mutation below. Verify the mutation manually: add a scratch member to a local copy of the Record and watch `tsc` fail — do not commit the mutation.
- [ ] **Step 3: Implement the compile gate** — hoist the block above `PILL_DEFINITIONS` (pill.tsx is `'use client'`: TYPE import only):

```tsx
import type { WatcherRunStatus } from '@haiwave/protocol';

// Exhaustive against the protocol union: a 7th WatcherRunStatus member fails
// the BUILD here (v1.73 WP4 §3.6). satisfies keeps the literal string values.
const RUN_STATUS_DEFINITIONS = {
  running: 'The run is in progress.',
  complete: 'The run finished and all targets were observed.',
  partial: 'The run finished but some targets could not be observed.',
  failed: 'The run stopped before completing. See the reason for the specific failure.',
  cancelled: 'The run was cancelled by an operator before completing.',
  throttled: 'The run paused because its hop budget was exhausted; it will resume automatically.',
} satisfies Record<WatcherRunStatus, string>;
```

and inside `PILL_DEFINITIONS`: `run_status: RUN_STATUS_DEFINITIONS,` (copy strings byte-identical from the current block).

- [ ] **Step 4: Run green** — `npm run test -- pill` + `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add src/components/pill.tsx src/components/__tests__/pill.test.tsx
git commit -m "feat(pills): run_status definitions typed exhaustively against WatcherRunStatus"
```

---

### Task 11: Cross-boundary pin — the `change_kind` mirror can no longer drift

**Files:**
- Test: `src/components/__tests__/change-kind-mirror.test.ts` (new)

- [ ] **Step 1: Write the failing-capable test**

```ts
import { describe, it, expect } from 'vitest';
// The mirror exists BECAUSE client components can't value-import the CJS
// protocol package (pill.tsx:157 comment). Tests CAN — so the test is where
// the two copies meet.
import { CHANGE_KIND_DEFINITION } from '@haiwave/protocol';
import { definitionFor } from '../pill';

describe('pill.tsx change_kind mirror ↔ protocol CHANGE_KIND_DEFINITION', () => {
  it('mirrors every protocol kind byte-for-byte', () => {
    // Named mutation: edit one mirrored string in pill.tsx (or add a kind to
    // the protocol without mirroring it) → this fails.
    // Direction is protocol ⊆ mirror: the mirror MAY carry kinds ahead of the
    // installed protocol version (v1.73 forward-carries upstream_risk_reported
    // before WP3's 3.66.0 lands) — those extras are asserted by name below so
    // nothing unknown hides in the mirror.
    for (const [kind, definition] of Object.entries(CHANGE_KIND_DEFINITION)) {
      expect(definitionFor('change_kind', kind), `mirror missing: ${kind}`).toBe(definition);
    }
  });
});
```

- [ ] **Step 2: Run it** — GREEN against today's 13-key mirror (the value is the standing pin; the red proof is the named mutation — verify once locally by editing one mirror string, watch it fail, revert).
- [ ] **Step 3–4:** nothing further to implement.
- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/change-kind-mirror.test.ts
git commit -m "test(pills): pin the change_kind hand-mirror byte-for-byte to protocol"
```

---

### Task 12: Forward-carry `upstream_risk_reported` (dormant until 3.66.0, visible the day it lands)

**Files:**
- Modify: `src/components/pill.tsx` (change_kind mirror), `src/app/account/sonar/posture/changes/_lib/event-kind-pills.ts`, `src/app/account/sonar/audit/events/_lib/event-kind-pills.ts`, `src/app/account/sonar/_lib/describe-change.ts`
- Modify tests: `src/app/account/sonar/posture/changes/__tests__/changes-feed.test.tsx:143-170`, `src/app/account/sonar/audit/events/__tests__/changes-feed.test.tsx:144-166`, `src/components/__tests__/change-kind-mirror.test.ts` (extras assertion), `e2e/walk.spec.ts:805-812` (16.2 pin: 4 pills → 5)
- Create: `src/app/account/sonar/__tests__/backlog-kind-partition.test.ts`, `src/app/account/sonar/_lib/__tests__/describe-change-authored.test.ts`

**Wire-safety (verified at haiCore origin/main `52277894`):** the changes route drops unknown kinds — `const kinds = rawKinds.filter((k) => ComplianceChangeKindSchema.safeParse(k).success);` with comment "ignore unknown values" (`sonar-compliance-changes.ts`). Sending the new kind at 3.64.0/3.65.0 is a server-side no-op; no error, identical rows. No client-side runtime filtering is needed or allowed (protocol value-imports are test-only).

**Type-safety at 3.64.0:** `'upstream_risk_reported'` is not yet a member of `EmittedChangeKind`, so it can appear in a `case` label or an `Extract<>` union ONLY after 3.66.0. Everything below is written to compile against BOTH versions.

- [ ] **Step 1: Write the failing tests**

Watcher-side literal pin (edit lines 143-170 of `posture/changes/__tests__/changes-feed.test.tsx`): expected array becomes

```ts
    expect(actual).toEqual([
      'lead_time_degraded',
      'lead_time_improved',
      'promise_date_improved',
      'promise_date_slipped',
      'upstream_risk_reported',
    ]);
```

(FORBIDDEN list unchanged.)

Audit-side derived pin (edit `audit/events/__tests__/changes-feed.test.tsx:144-166`): add `'upstream_risk_reported'` to `EXCLUDED` — a no-op filter today, load-bearing the day 3.66.0's `EMITTED_CHANGE_KINDS` gains the kind.

New disjointness pin `src/app/account/sonar/__tests__/backlog-kind-partition.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EVENT_KIND_PILLS as WATCHER_KINDS } from '../posture/changes/_lib/event-kind-pills';
import { EVENT_KIND_PILLS as AUDIT_KINDS } from '../audit/events/_lib/event-kind-pills';

describe('Watcher Backlog ↔ Event Backlog kind partition', () => {
  it('is disjoint (spec §5 — named mutation: add a kind to both sides → fails)', () => {
    const audit = new Set<string>(AUDIT_KINDS);
    const overlap = WATCHER_KINDS.filter((k) => audit.has(k));
    expect(overlap).toEqual([]);
  });
  it('upstream_risk_reported is watcher-side only', () => {
    expect(WATCHER_KINDS).toContain('upstream_risk_reported');
    expect(AUDIT_KINDS).not.toContain('upstream_risk_reported');
  });
});
```

Authored label test `src/app/account/sonar/_lib/__tests__/describe-change-authored.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { describeChange } from '../describe-change';
import type { ComplianceChange } from '@haiwave/protocol';

describe('describeChange authored overrides', () => {
  it('upstream_risk_reported gets the authored label, not titlecase, and no dev warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const change = {
      change_kind: 'upstream_risk_reported',
      prior_value: null,
      current_value: null,
      component_ref: 'SKU-1',
    } as unknown as ComplianceChange; // legal only from 3.66.0; cast documents the forward-carry
    expect(describeChange(change)).toBe(
      'The vendor reports risk to this order from its own upstream supply chain — its promise is unchanged; treat this as advance warning.',
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

Mirror-extras assertion (append to `change-kind-mirror.test.ts`):

```ts
  it('mirror extras beyond the installed protocol are exactly the declared forward-carries', () => {
    const protocolKinds = new Set(Object.keys(CHANGE_KIND_DEFINITION));
    const extras = changeKindMirrorKeys().filter((k) => !protocolKinds.has(k));
    // At 3.64.0/3.65.0 this is ['upstream_risk_reported']; from 3.66.0 it is [].
    expect(extras.every((k) => k === 'upstream_risk_reported')).toBe(true);
  });
```

(This needs the mirror's key list exported for tests: add to `pill.tsx` — `export function changeKindMirrorKeys(): string[] { return Object.keys(PILL_DEFINITIONS.change_kind); }` — a function export, safe across the RSC boundary; import it alongside `definitionFor` in the test.)

- [ ] **Step 2: Run red** — the four new/updated assertions fail (missing entries).
- [ ] **Step 3: Implement**

`pill.tsx` change_kind mirror — append (copy WP3's authored string BYTE-EXACT, straight apostrophe escaped, from haiCore plan `2026-08-11-wp3-orders-view-recursive-ops.md` Task 3):

```tsx
    // v1.73 WP4 forward-carry — lands in protocol CHANGE_KIND_DEFINITION with
    // 3.66.0 (WP3). Same hand-mirror constraint as the block comment above;
    // keep verbatim in sync the day WP3 merges (the mirror pin test enforces).
    upstream_risk_reported:
      'The vendor reports risk to this order from its own upstream supply chain. The vendor\'s promise is unchanged; the flag is advance warning.',
```

`posture/changes/_lib/event-kind-pills.ts` — widen the element type (an `Extract<>` member that doesn't exist yet would silently collapse, so the forward-carry is a literal union member, folded back into `Extract<>` after WP3 merges):

```ts
// v1.73 WP4: upstream_risk_reported is carried ahead of its protocol mint
// (3.66.0, WP3). The literal union keeps this compiling against 3.64.0 —
// Extract<> would drop a not-yet-existing member and the array literal would
// fail. haiCore ignores unknown kinds on the wire (safeParse filter), so the
// entry is dormant until 3.66.0 deploys, then visible with zero further change.
// Post-WP3 cleanup: fold the literal back into the Extract<> union.
type WatcherBacklogKind =
  | Extract<EmittedChangeKind, 'lead_time_degraded' | 'lead_time_improved' | 'promise_date_slipped' | 'promise_date_improved'>
  | 'upstream_risk_reported';

export const EVENT_KIND_PILLS: ReadonlyArray<WatcherBacklogKind> = [
  'lead_time_degraded',
  'lead_time_improved',
  'promise_date_slipped',
  'promise_date_improved',
  'upstream_risk_reported',
] as const;
```

and the tooltip map entry (definition first, then the filter action — the file's stated pattern):

```ts
  upstream_risk_reported: 'The vendor reports risk to this order from its own upstream supply chain — its promise is unchanged. Click to filter the feed to upstream-risk events only.',
```

`audit/events/_lib/event-kind-pills.ts` — add `'upstream_risk_reported'` to the `Exclude<>` union (no-op at 3.64.0, correct at 3.66.0) and extend the "MINUS" comment with the WP4 line.

`describe-change.ts` — string-keyed authored overrides ABOVE the switch's default path:

```ts
// v1.73 WP4 — authored labels for kinds carried ahead of the installed
// protocol version. String-keyed map, deliberately NOT switch cases: a case
// label that is not yet a ComplianceChangeKind member fails to compile
// against 3.64.0. Checked before the titlecase fallback so the feed never
// shows raw snake_case for a kind we already know how to describe.
const AUTHORED_DESCRIPTIONS: Record<string, string> = {
  upstream_risk_reported:
    'The vendor reports risk to this order from its own upstream supply chain — its promise is unchanged; treat this as advance warning.',
};
```

and in the `default:` branch, before the dev warn:

```ts
    default: {
      const authored = AUTHORED_DESCRIPTIONS[kind];
      if (authored) return authored;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[describeChange] no description for kind:', kind);
      }
      return kindLabel(kind);
    }
```

`e2e/walk.spec.ts` 16.2 (:805-812): the pill count assertion moves from 4 to 5 and the test name says why:

```ts
  test("16.2 Watcher Backlog renders 5 lowercase kind pills (incl. dormant upstream risk, v1.73); toggle works", async ({
```

(keep the body's existing assertions; if it counts pills explicitly, update the count to 5 — re-read at dispatch.)

- [ ] **Step 4: Run green** — `npm run test -- changes-feed backlog-kind-partition describe-change change-kind-mirror pill` + `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add src/components/pill.tsx src/components/__tests__/change-kind-mirror.test.ts src/app/account/sonar/posture/changes/_lib/event-kind-pills.ts src/app/account/sonar/audit/events/_lib/event-kind-pills.ts src/app/account/sonar/_lib/describe-change.ts src/app/account/sonar/__tests__/backlog-kind-partition.test.ts src/app/account/sonar/_lib/__tests__/describe-change-authored.test.ts src/app/account/sonar/posture/changes/__tests__/changes-feed.test.tsx src/app/account/sonar/audit/events/__tests__/changes-feed.test.tsx e2e/walk.spec.ts
git commit -m "feat(sonar): forward-carry upstream_risk_reported across allowlist, pills, and authored labels (dormant until 3.66.0)"
```

---

### Task 13: Wizard picker `universe` prop — watcher scope draws from trading pairs (#22)

**Files:**
- Modify: `src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx` (props :49-61, fetch effect :120-138, catalog filter :174-205, empty state :399-409, summary copy :411-420), `src/app/account/sonar/watchers/new/_components/watcher-scope-picker.tsx:70-77`
- Test: `src/app/account/sonar/_components/__tests__/bilateral-universe.test.tsx` (new)

**Interfaces:**
- Produces: `universe?: 'accepted_audit_scopes' | 'bilateral_connections'` on the shared component's Props (default `'accepted_audit_scopes'` — the audit wizard passes nothing and keeps today's behavior bit-for-bit).
- Consumes: `/api/account/partners` (existing BFF; rows shaped `{ id, company_name, status, ... }` where `status` is the haiCore `relationship_state`).
- Preserved invariants: `emitWith`'s counterparty derivation from `cp.product_ids` membership; the submit-summary bar in `watcher-wizard.tsx` (untouched); `sku_asks` hydration; the orphan-SKU `<details>` (audit universe only), tested by PRESENCE.

Server-half verdict (deviation 1, decided): no haiCore change. Authorization basis for watcher scope is the trading pair, enforced at signal time by `WatcherSignalService.REQUIREMENT`; template creation has no scope gate. The picker only needs to offer the honest universe.

Mechanism: under `bilateral_connections` the mount fetch loads trading pairs with `product_ids: []`, and each lazily-loaded catalog **folds its product ids back into `options`** — so `emitWith`, the selection counter, and orphan logic keep operating on `cp.product_ids` unchanged. (Under this universe the catalog IS the SKU universe; under audit it remains the accepted-scope intersection.)

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BilateralCounterpartiesSkusFields } from '../bilateral-counterparties-skus-fields';

const PARTNERS = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', company_name: 'MidWest Fastener Corp', status: 'trading_pair' },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', company_name: 'Precision Plastics Inc', status: 'approved' },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BilateralCounterpartiesSkusFields — universe prop', () => {
  it('bilateral_connections lists trading pairs (never approved-only partners) and never calls wizard-options', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/account/partners') {
        return new Response(JSON.stringify(PARTNERS), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    render(
      <BilateralCounterpartiesSkusFields
        skus={[]}
        onChange={() => {}}
        universe="bilateral_connections"
      />,
    );
    expect(await screen.findByText('MidWest Fastener Corp')).toBeInTheDocument();
    expect(screen.queryByText('Precision Plastics Inc')).toBeNull();
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).not.toContain(
      '/api/account/sonar/audit/wizard-options',
    );
  });

  it('bilateral empty state names Partners, not audit nomination ceremony', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    render(
      <BilateralCounterpartiesSkusFields skus={[]} onChange={() => {}} universe="bilateral_connections" />,
    );
    expect(await screen.findByText(/no active trading pairs/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /partners/i })).toHaveAttribute('href', '/account/partners');
    expect(screen.queryByText(/nomination/i)).toBeNull();
  });

  it('default universe still fetches wizard-options (audit wizard unchanged)', async () => {
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ counterparties: [] }), { status: 200 }),
    );
    render(<BilateralCounterpartiesSkusFields skus={[]} onChange={() => {}} />);
    await waitFor(() =>
      expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain(
        '/api/account/sonar/audit/wizard-options',
      ),
    );
  });
});
```

- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement**

Props (extend the existing interface + destructure):

```tsx
  /**
   * Which counterparty universe the picker offers (v1.73 WP4, walk #22).
   * 'accepted_audit_scopes' (default) — the audit wizard's accepted+active
   *   audit scopes via /api/account/sonar/audit/wizard-options; SKUs are the
   *   accepted intersection of the counterparty's catalog, orphans listed.
   * 'bilateral_connections' — active trading pairs via /api/account/partners
   *   (the trust tier the watcher signal gate actually enforces); SKUs are
   *   the counterparty's public catalog, no accepted-scope intersection, no
   *   orphan section. Watcher scope needs no audit ceremony.
   */
  universe?: 'accepted_audit_scopes' | 'bilateral_connections';
```

Mount fetch (replace the effect body's fetch branch):

```tsx
      try {
        if (universe === 'bilateral_connections') {
          const res = await fetch('/api/account/partners');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const partners = (await res.json()) as Array<{
            id: string; company_name: string; status: string;
          }>;
          const body: WizardOptions = {
            counterparties: partners
              .filter((p) => p.status === 'trading_pair')
              .map((p) => ({
                counterparty_id: p.id,
                counterparty_legal_name: p.company_name,
                // Populated lazily as each catalog loads — the catalog IS the
                // SKU universe under this basis (no accepted-scope set exists).
                product_ids: [],
              })),
          };
          if (!cancelled) setOptions(body);
        } else {
          const res = await fetch('/api/account/sonar/audit/wizard-options');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as WizardOptions;
          if (!cancelled) setOptions(body);
        }
      } catch {
        if (!cancelled)
          setOptionsError(
            universe === 'bilateral_connections'
              ? "Couldn't load trading partners. Try again in a moment."
              : "Couldn't load accepted counterparties. Try again in a moment.",
          );
      } finally { /* unchanged */ }
```

`loadCatalog` — two universe-aware lines plus the fold-back:

```tsx
        // Audit universe: only accepted-scope SKUs are selectable (intersection).
        // Bilateral universe: the whole public catalog is selectable.
        const accepted =
          universe === 'bilateral_connections' ? null : new Set(cp.product_ids);
        ...
        for (const p of productsBody.products ?? []) {
          if (accepted && !accepted.has(p.external_product_id)) continue;
          ...
        }
        const orphanIds = accepted
          ? cp.product_ids.filter((id) => !seen.has(id)).sort()
          : [];
        if (!accepted) {
          // Fold the catalog's ids into options so emitWith's counterparty
          // derivation and the selection counter keep reading cp.product_ids.
          setOptions((prev) =>
            prev && {
              counterparties: prev.counterparties.map((c) =>
                c.counterparty_id === cp.counterparty_id
                  ? { ...c, product_ids: Array.from(seen).sort() }
                  : c,
              ),
            },
          );
        }
```

Empty state (branch on universe; audit branch verbatim-unchanged):

```tsx
  if (!options || options.counterparties.length === 0) {
    if (universe === 'bilateral_connections') {
      return (
        <div className="rounded border border-slate/20 bg-slate/5 px-3 py-3 text-sm text-charcoal">
          No active trading pairs yet. Watchers observe your established trading
          partners — connect with one under{' '}
          <a className="text-teal underline" href="/account/partners">Partners</a>{' '}
          and the pair&apos;s catalog will appear here.
        </div>
      );
    }
    return ( /* existing audit empty state, untouched */ );
  }
```

Summary copy (line ~417): suffix becomes universe-aware — `...counterparties with accepted scopes.` → `` {universe === 'bilateral_connections' ? 'active trading pairs.' : 'counterparties with accepted scopes.'} ``.

`watcher-scope-picker.tsx:70-77` — add `universe="bilateral_connections"` to the `<BilateralCounterpartiesSkusFields …>` mount (audit's `audit-scope-picker.tsx` mount untouched).

- [ ] **Step 4: Run green** — `npm run test -- bilateral` (the existing component tests must stay green untouched — that is the audit-unchanged proof) + `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx src/app/account/sonar/watchers/new/_components/watcher-scope-picker.tsx src/app/account/sonar/_components/__tests__/bilateral-universe.test.tsx
git commit -m "feat(sonar): watcher wizard picker draws from active trading pairs via universe prop (#22)"
```

---

### Task 14: Heartbeat alert names the jailed agents and links somewhere real (#18)

**Files:**
- Modify: `src/app/account/_components/dashboard-alert-bar.tsx`, `src/app/account/page.tsx:51-97`
- Test: `src/app/account/_components/__tests__/dashboard-alert-bar.test.tsx` (extend or create — re-check at dispatch)

**Interfaces:**
- Produces: `DashboardAlertBarProps.agents: { total: number; jailed: number; jailedNames: string[] } | null`; `Alert` gains `href?: string; hrefLabel?: string`.
- Consumes: `AgentSummary.name: string | null` (already returned by `listAgents()` — no new fetch).
- Preserved invariants: `null` input never alerts (an outage is not an accusation); keying on `jailed`, never `active === 0`.

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardAlertBar } from '../dashboard-alert-bar';

describe('DashboardAlertBar heartbeat alert', () => {
  it('names the jailed agents and links to the Agents page', () => {
    render(
      <DashboardAlertBar
        agents={{ total: 5, jailed: 2, jailedNames: ['Arno', 'Mekong'] }}
        accountStatus="active"
      />,
    );
    expect(screen.getByText(/2 of 5 agents unreachable/)).toBeInTheDocument();
    expect(screen.getByText(/Unreachable: Arno, Mekong/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /check agent health/i })).toHaveAttribute(
      'href',
      '/account/agents',
    );
    expect(screen.queryByText(/Agent Management/)).toBeNull();
  });
  it('caps the name list at two and counts the rest', () => {
    render(
      <DashboardAlertBar
        agents={{ total: 6, jailed: 4, jailedNames: ['Arno', 'Mekong', 'Vomero', 'Apex'] }}
        accountStatus="active"
      />,
    );
    expect(screen.getByText(/Unreachable: Arno, Mekong \+2 more/)).toBeInTheDocument();
  });
  it('all-jailed stays blocking and still names agents', () => {
    render(
      <DashboardAlertBar
        agents={{ total: 2, jailed: 2, jailedNames: ['Arno', 'Mekong'] }}
        accountStatus="active"
      />,
    );
    expect(screen.getByText('No agents are reachable')).toBeInTheDocument();
    expect(screen.getByText(/Arno, Mekong/)).toBeInTheDocument();
  });
  it('null fleet stays silent — unknown is never an accusation', () => {
    const { container } = render(<DashboardAlertBar agents={null} accountStatus="active" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run red** (prop type + copy don't exist).
- [ ] **Step 3: Implement**

`dashboard-alert-bar.tsx`:

```tsx
import Link from "next/link";
```

- Props: `agents: { total: number; jailed: number; jailedNames: string[] } | null;` (extend the doc comment: names are haiCore's own agent names, id-slice fallback resolved by the caller).
- `Alert`: `interface Alert { severity: Severity; headline: string; detail: string; href?: string; hrefLabel?: string; }`
- Name formatting + both branches:

```tsx
/** "Arno, Mekong" or "Arno, Mekong +2 more" — two names, then a count. */
function nameList(names: string[]): string {
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
}
```

```tsx
  if (agents && agents.jailed > 0) {
    const everyAgent = agents.jailed === agents.total;
    const names = nameList(agents.jailedNames);
    alerts.push(
      everyAgent
        ? {
            severity: "blocking",
            headline: "No agents are reachable",
            detail: `Every agent has stopped answering heartbeats (${names}), so no inbound quote request can be answered.`,
            href: "/account/agents",
            hrefLabel: "Check agent health under Agents.",
          }
        : {
            severity: "degraded",
            headline: `${agents.jailed} of ${agents.total} agents unreachable`,
            detail: `Unreachable: ${names}. A jailed agent returns to service automatically once it answers heartbeats again.`,
            href: "/account/agents",
            hrefLabel: "Check agent health under Agents.",
          },
    );
  }
```

Render (inside the alert div, after the detail span):

```tsx
          {alert.href && (
            <Link href={alert.href} className="ml-2 underline decoration-dotted hover:decoration-solid">
              {alert.hrefLabel}
            </Link>
          )}
```

`account/page.tsx` — carry names through the projection (keep the three counts; add names with an id-slice fallback so a nameless agent is still identifiable):

```tsx
        return {
          total: agents.length,
          active: agents.filter((a) => a.status === "active").length,
          jailed: agents.filter((a) => a.status === "jailed").length,
          jailedNames: agents
            .filter((a) => a.status === "jailed")
            .map((a) => a.name ?? a.id.slice(0, 8)),
        };
```

and the mount: `agents={fleet && { total: fleet.total, jailed: fleet.jailed, jailedNames: fleet.jailedNames }}`.

- [ ] **Step 4: Run green** + `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add src/app/account/_components/dashboard-alert-bar.tsx src/app/account/page.tsx src/app/account/_components/__tests__/dashboard-alert-bar.test.tsx
git commit -m "feat(dashboard): heartbeat alert names jailed agents and links to Agents (#18)"
```

---

### Task 15: Pin the production mock gate (three-state, part 1)

**Files:**
- Test: `src/lib/__tests__/with-hai-core-prod-gate.test.ts` (new)

Deviation 4: the gate already exists (`with-hai-core.ts:118, :148` — fallback only when `NODE_ENV !== "production"`). This task pins it so it cannot regress silently. Named mutation: delete either `process.env.NODE_ENV !== "production"` guard → this test fails.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { withHaiCore } from '../with-hai-core';

// Session + token mocks: production-shaped (JWT-like token, valid session).
vi.mock('../session', () => ({
  getSession: vi.fn(async () => ({ participant_id: 'p-1', role: 'owner' })),
  getToken: vi.fn(async () => 'aaa.bbb.ccc'),
}));
// ^ Re-read with-hai-core.ts's actual session/token import names at dispatch
//   and mirror them exactly — the mock must satisfy the wrapper's real deps.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('withHaiCore production mock gate', () => {
  it('a haiCore outage in production returns 500, never the fallback (mock) body', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const FALLBACK = [{ company_name: 'MidWest Fastener Corp' }];
    const handler = withHaiCore(
      async () => {
        throw new Error('ECONNREFUSED haiCore');
      },
      { fallback: FALLBACK },
    );
    const res = await handler(
      new NextRequest('http://localhost/api/account/partners'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('MidWest Fastener Corp');
    expect(res.headers.get('x-haiwave-data-source')).toBeNull();
  });

  it('the same outage in development serves the fallback, marked as such', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const handler = withHaiCore(
      async () => {
        throw new Error('ECONNREFUSED haiCore');
      },
      { fallback: [{ company_name: 'MidWest Fastener Corp' }] },
    );
    const res = await handler(
      new NextRequest('http://localhost/api/account/partners'),
      { params: Promise.resolve({}) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('x-haiwave-data-source')).toBe('fallback');
  });
});
```

- [ ] **Step 2: Run it** — GREEN (the gate exists); verify the named mutation once locally (comment out one guard, watch both directions fail, revert).
- [ ] **Step 3–4:** no implementation.
- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/with-hai-core-prod-gate.test.ts
git commit -m "test(bff): pin the production gate on withHaiCore fallbacks — outages never serve mock data"
```

---

### Task 16: Grid identity three-state — redacted by wire flag only, unresolved is not a chip

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx:61-74` (helpers), `:200-209` (group build), `:305-336` (render)
- Test: `src/app/account/sonar/watchers/[id]/_components/__tests__/counterparties-grid.test.tsx` (pins at :57-81 change meaning)

**Interfaces:**
- Produces: `IdentityDisplay` union (the tree-view `NodeDisplay` model, converged): `{ kind: 'undisclosed' } | { kind: 'unresolved'; id: string } | { kind: 'name'; label: string }`. Task 17 extends the `undisclosed` arm with alias/parent.
- Preserved: `counterpartyName` stays computed for sort/search; it stops informing the redaction decision.

Semantics change (this is the landmine fix): today a tier-1 row whose name lookup failed renders the identity-withheld CHIP (`isUndisclosed` = null id **or** falsy name) — a name-resolution miss presented as a redaction claim. After: the chip is decided by the WIRE's redaction signal only (`counterparty_participant_id === null`); a known id with no resolvable name renders the truncated id + "name unavailable".

- [ ] **Step 1: Write the failing test** — update `counterparties-grid.test.tsx`'s no-name case (:68-81 region):

```tsx
  it('a known id with no resolvable name renders unresolved — truncated id, never the redaction chip', () => {
    render(
      <CounterpartiesGrid
        results={[makeResult({ counterparty_name: null })]}
      />,
    );
    // aaaaaaaa is the fixture id's first 8 chars.
    expect(screen.getByText(/aaaaaaaa/)).toBeInTheDocument();
    expect(screen.getByText(/name unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText('Identity withheld')).toBeNull();
    expect(screen.queryByText('Vendor Name Not Disclosed')).toBeNull();
  });
  it('null participant id (wire redaction) still renders the chip', () => {
    render(<CounterpartiesGrid results={[makeResult({ counterparty_participant_id: null })]} />);
    expect(screen.getByText('Identity withheld')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run red** (first test fails — chip renders today).
- [ ] **Step 3: Implement**

Replace `nameOf`/`isUndisclosed` with the converged model:

```tsx
// v1.73 WP4 three-state identity (converges on tree-view's NodeDisplay model):
//   undisclosed — the WIRE says redacted (null participant id = tier-2+
//                 aggregate). Only this state renders the chip; redaction is
//                 never inferred from a lookup miss.
//   unresolved  — id known, name lookup failed (haiCore partner list gap or
//                 outage). Truncated id + "name unavailable" — an honest gap,
//                 not an accusation of withholding.
//   name        — resolved display name.
type IdentityDisplay =
  | { kind: 'undisclosed' }
  | { kind: 'unresolved'; id: string }
  | { kind: 'name'; label: string };

function identityOf(r: EnrichedWatcherResult): IdentityDisplay {
  if (r.counterparty_participant_id === null) return { kind: 'undisclosed' };
  // `!name` (not `?? `): an empty-string name is as unresolved as a missing one.
  if (!r.counterparty_name) return { kind: 'unresolved', id: r.counterparty_participant_id };
  return { kind: 'name', label: r.counterparty_name };
}

// Sort/search key only — never a rendered string and never a redaction signal.
function sortKeyOf(d: IdentityDisplay): string {
  switch (d.kind) {
    case 'name': return d.label;
    case 'unresolved': return d.id;
    case 'undisclosed': return '￿'; // sorts last among equals
  }
}
```

`CounterpartyGroup` gains `identity: IdentityDisplay` (replacing the `undisclosed: boolean` discriminant; keep `counterpartyName` as `sortKeyOf(identity)` for the existing sort/filter lines). Group build: `identity: identityOf(r)`.

Render (:313 region):

```tsx
                {g.identity.kind === 'undisclosed' ? (
                  <VerifiedUndisclosedChip />
                ) : g.identity.kind === 'unresolved' ? (
                  <span className="flex items-baseline gap-1">
                    <span className="font-mono text-xs text-charcoal">{g.identity.id.slice(0, 8)}…</span>
                    <span className="text-xs italic text-slate">name unavailable</span>
                  </span>
                ) : (
                  <span className="font-medium text-charcoal">{g.identity.label}</span>
                )}
```

Delete the now-dead `'Identity withheld'` / `'Vendor Name Not Disclosed'` literals from this file (the chip carries the only user-facing "Identity withheld"). Search filter: matching against `sortKeyOf` means unresolved rows are findable by id prefix — note in a comment.

- [ ] **Step 4: Run green** — `npm run test -- counterparties-grid` + `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add "src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx" "src/app/account/sonar/watchers/[id]/_components/__tests__/counterparties-grid.test.tsx"
git commit -m "fix(sonar): grid identity is three-state — chip only on wire redaction, lookup miss renders unresolved"
```

---

### Task 17: Grid undisclosed rows group per sub-tier cluster with parent attribution (Ruling 4, haiWeb half)

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx:194-213` (grouping), render block
- Test: `src/app/account/sonar/watchers/[id]/_components/__tests__/counterparties-grid.test.tsx`

**Interfaces:**
- Consumes: `IdentityDisplay` (Task 16); `WatcherResult.aggregated_under_tier_1` (tier-1 path root `result_id`, present on every sub-tier row).
- Produces: `undisclosed` arm extended to `{ kind: 'undisclosed'; parentName?: string | null; alias?: string | null }`. Task 24 (Phase 2) fills `alias` from the wire; until then it is always absent and the chip renders "Identity withheld".

Today ALL null-id rows collapse into ONE `'__identity_withheld__'` bucket, losing which tier-1 vendor each redacted cluster sits under. Ruling 4's rendered form is `<direct name> + Supplier 'x'` — the parent half ships now; the letter arrives with 3.67.0.

- [ ] **Step 1: Write the failing test**

```tsx
  it('undisclosed rows group per sub-tier cluster with the tier-1 parent named (Ruling 4)', () => {
    const tier1A = makeResult({ result_id: 'a1111111-1111-1111-1111-111111111111', counterparty_name: 'Arno Industrial' });
    const tier1B = makeResult({
      result_id: 'b2222222-2222-2222-2222-222222222222',
      counterparty_participant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      counterparty_name: 'Mekong Supply',
    });
    const subA = makeResult({
      counterparty_participant_id: null, tier: 2,
      aggregated_under_tier_1: 'a1111111-1111-1111-1111-111111111111',
    });
    const subB = makeResult({
      counterparty_participant_id: null, tier: 2,
      aggregated_under_tier_1: 'b2222222-2222-2222-2222-222222222222',
    });
    render(<CounterpartiesGrid results={[tier1A, tier1B, subA, subB]} />);
    // Two distinct undisclosed groups, each attributed to its parent.
    expect(screen.getAllByText('Identity withheld')).toHaveLength(2);
    expect(screen.getByText(/Arno Industrial \+/)).toBeInTheDocument();
    expect(screen.getByText(/Mekong Supply \+/)).toBeInTheDocument();
  });
```

(Named mutation for the walk-plan row: collapse the cluster keys back to one bucket → this fails.)

- [ ] **Step 2: Run red** (today: one merged bucket, no parent text).
- [ ] **Step 3: Implement**

Grouping key + parent resolution (inside the `useMemo`, before the row loop):

```tsx
    // Tier-1 rows indexed by result_id so sub-tier clusters can name their
    // parent. aggregated_under_tier_1 is the tier-1 path root result_id.
    const tier1NameByResultId = new Map<string, string | null>();
    for (const r of results) {
      if (r.counterparty_participant_id !== null) {
        tier1NameByResultId.set(r.result_id, r.counterparty_name ?? null);
      }
    }
```

Row loop key: `const key = r.counterparty_participant_id ?? `withheld:${r.aggregated_under_tier_1 ?? 'unrooted'}`;`

Group creation for undisclosed rows:

```tsx
        identity:
          r.counterparty_participant_id === null
            ? {
                kind: 'undisclosed' as const,
                parentName: r.aggregated_under_tier_1
                  ? tier1NameByResultId.get(r.aggregated_under_tier_1) ?? null
                  : null,
                alias: null, // wire supplier_alias joins with protocol 3.67.0 (Phase 2)
              }
            : identityOf(r),
```

Render:

```tsx
                {g.identity.kind === 'undisclosed' ? (
                  <span className="flex items-baseline gap-1.5">
                    {g.identity.parentName && (
                      <span className="text-sm text-charcoal">{g.identity.parentName} +</span>
                    )}
                    <VerifiedUndisclosedChip alias={g.identity.alias} />
                  </span>
                ) : ...
```

(`VerifiedUndisclosedChip` already renders `Supplier ${alias}` when alias is set and "Identity withheld" otherwise — no chip change.)

- [ ] **Step 4: Run green** — full grid test file + `npm run build`. The pre-existing "aggregates null-identity rows" test (:57-66) keeps passing when its fixture rows share one `aggregated_under_tier_1` — re-read and adjust its fixture if it mixed parents.
- [ ] **Step 5: Commit**

```bash
git add "src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx" "src/app/account/sonar/watchers/[id]/_components/__tests__/counterparties-grid.test.tsx"
git commit -m "feat(sonar): undisclosed grid rows group per sub-tier cluster with tier-1 parent named (Ruling 4)"
```

---

### Task 18: Three new signal panels — OPS, order-fulfilment history, soft-quoted (#3.1)

**Files:**
- Create: `src/app/account/sonar/watchers/[id]/_components/order-promise-schedule-panel.tsx`, `order-fulfillment-history-panel.tsx`, `soft-quoted-lead-time-panel.tsx`
- Test: `src/app/account/sonar/watchers/[id]/_components/__tests__/new-signal-panels.test.tsx` (new)

**Interfaces:**
- Produces: three panels, each `({ synthesisMode, payload }: { synthesisMode: WatcherSynthesisMode; payload: <P> | null })` — the exact `signalRow<…>()` contract `CapacityBandPanel` uses. Task 19 wires them into the grid.
- Payload shapes (protocol 3.63.0+, verbatim from `watcher/result.ts` + `watcher/signal.ts`): `OrderPromiseSchedulePayload { kind:'direct'; order_id; vendor_order_reference?; observed_at; lines: [{ line_number; promised: [{date; quantity}]; current: [{date; quantity}] }] }`; `OrderFulfillmentHistoryPayload { kind:'direct'; active_orders: [{po_number; quantity; quoted_ship_date}]; recent_fulfillments: [+actual_ship_date]; calibrated: {days; sample_count} }`; `SoftQuotedLeadTimePayload { kind:'direct'; days: number|null; availability: 'available'|'partial'|'unavailable'; ask_quantity; resolved_via; observed_at }`.
- These three signals have NO aggregated variants in `WatcherPayloadSchema` — any non-direct synthesis mode renders the not-shared line (defensive, same as gap).

- [ ] **Step 1: Write the failing tests**

```tsx
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderPromiseSchedulePanel } from '../order-promise-schedule-panel';
import { OrderFulfillmentHistoryPanel } from '../order-fulfillment-history-panel';
import { SoftQuotedLeadTimePanel } from '../soft-quoted-lead-time-panel';

describe('OrderPromiseSchedulePanel', () => {
  it('renders promised → current per line with the slip delta', () => {
    render(
      <OrderPromiseSchedulePanel
        synthesisMode="direct"
        payload={{
          kind: 'direct',
          order_id: '11111111-1111-1111-1111-111111111111',
          vendor_order_reference: 'SO-1042',
          observed_at: '2026-08-01T00:00:00Z',
          lines: [
            {
              line_number: 1,
              promised: [{ date: '2026-08-10', quantity: 100 }],
              current: [
                { date: '2026-08-10', quantity: 40 },
                { date: '2026-08-17', quantity: 60 },
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/SO-1042/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-10 → 2026-08-17/)).toBeInTheDocument();
    expect(screen.getByText(/7d later/)).toBeInTheDocument();
  });
  it('re-split without completion movement reads "on promise"', () => {
    render(
      <OrderPromiseSchedulePanel
        synthesisMode="direct"
        payload={{
          kind: 'direct',
          order_id: '11111111-1111-1111-1111-111111111111',
          observed_at: '2026-08-01T00:00:00Z',
          lines: [{ line_number: 2, promised: [{ date: '2026-08-10', quantity: 10 }], current: [{ date: '2026-08-10', quantity: 10 }] }],
        }}
      />,
    );
    expect(screen.getByText(/on promise/)).toBeInTheDocument();
  });
  it('gap renders honest not-shared copy', () => {
    render(<OrderPromiseSchedulePanel synthesisMode="redacted_gap" payload={null} />);
    expect(screen.getByText(/Order-promise signal not shared/)).toBeInTheDocument();
  });
});

describe('OrderFulfillmentHistoryPanel', () => {
  it('sample_count 0 reads as no observations, never as 0 days', () => {
    render(
      <OrderFulfillmentHistoryPanel
        synthesisMode="direct"
        payload={{ kind: 'direct', active_orders: [], recent_fulfillments: [], calibrated: { days: 0, sample_count: 0 } }}
      />,
    );
    expect(screen.getByText(/no observations yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0d/)).toBeNull();
  });
  it('renders calibrated days with observation count and recent quoted→actual rows', () => {
    render(
      <OrderFulfillmentHistoryPanel
        synthesisMode="direct"
        payload={{
          kind: 'direct',
          active_orders: [{ po_number: 'PO-9', quantity: 50, quoted_ship_date: '2026-08-20' }],
          recent_fulfillments: [{ po_number: 'PO-7', quantity: 25, quoted_ship_date: '2026-07-01', actual_ship_date: '2026-07-03' }],
          calibrated: { days: 18, sample_count: 12 },
        }}
      />,
    );
    expect(screen.getByText(/18d/)).toBeInTheDocument();
    expect(screen.getByText(/12 obs/)).toBeInTheDocument();
    expect(screen.getByText(/PO-7/)).toBeInTheDocument();
    expect(screen.getByText(/1 active order/)).toBeInTheDocument();
  });
});

describe('SoftQuotedLeadTimePanel', () => {
  it('renders days for the ask quantity', () => {
    render(
      <SoftQuotedLeadTimePanel
        synthesisMode="direct"
        payload={{ kind: 'direct', days: 9, availability: 'available', ask_quantity: 500, resolved_via: 'phantom_demand_bom', observed_at: '2026-08-01T00:00:00Z' }}
      />,
    );
    expect(screen.getByText(/9d/)).toBeInTheDocument();
    expect(screen.getByText(/500 units/)).toBeInTheDocument();
  });
  it('unavailable is stated, not zeroed', () => {
    render(
      <SoftQuotedLeadTimePanel
        synthesisMode="direct"
        payload={{ kind: 'direct', days: null, availability: 'unavailable', ask_quantity: 500, resolved_via: 'phantom_demand_bom', observed_at: '2026-08-01T00:00:00Z' }}
      />,
    );
    expect(screen.getByText(/unavailable for 500 units/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run red** (modules missing).
- [ ] **Step 3: Implement** (copy is hand-authored haiWeb copy — spec §3.1; local structural interfaces per the `CapacityBandPanel` idiom, `import type { WatcherSynthesisMode } from '@haiwave/protocol'` only):

`order-promise-schedule-panel.tsx`:

```tsx
import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface Portion { date: string; quantity: number }
interface Line { line_number: number; promised: Portion[]; current: Portion[] }
interface OpsPayload {
  kind: 'direct';
  order_id: string;
  vendor_order_reference?: string;
  observed_at: string;
  lines: Line[];
}
interface Props { synthesisMode: WatcherSynthesisMode; payload: OpsPayload | null }

// A line's completion date is the max portion date (describe-change.ts uses
// the same rule for the drift feed — keep them agreeing).
function completionDate(portions: Portion[]): string | null {
  let max: string | null = null;
  for (const p of portions) if (!max || p.date > max) max = p.date;
  return max;
}

function slipDays(promised: string | null, current: string | null): number | null {
  if (!promised || !current) return null;
  return Math.round(
    (new Date(`${current}T00:00:00Z`).getTime() - new Date(`${promised}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

export function OrderPromiseSchedulePanel({ synthesisMode, payload }: Props) {
  if (synthesisMode !== 'direct' || payload === null) {
    return <p className="text-sm italic text-slate">Order-promise signal not shared.</p>;
  }
  return (
    <div className="space-y-1 text-sm">
      {payload.vendor_order_reference && (
        <div className="text-xs text-slate">Order {payload.vendor_order_reference}</div>
      )}
      <ul className="space-y-0.5">
        {payload.lines.map((line) => {
          const promised = completionDate(line.promised);
          const current = completionDate(line.current);
          const delta = slipDays(promised, current);
          return (
            <li key={line.line_number} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-slate">Line {line.line_number}</span>
              <span className="text-charcoal">{promised ?? '—'} → {current ?? '—'}</span>
              {delta !== null && delta > 0 && (
                <span className="text-xs font-medium text-problem">{delta}d later</span>
              )}
              {delta !== null && delta < 0 && (
                <span className="text-xs font-medium text-success">{-delta}d earlier</span>
              )}
              {delta === 0 && <span className="text-xs text-slate">on promise</span>}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate">
        Promised vs the vendor ERP&apos;s current post-MRP schedule. Observed{' '}
        {new Date(payload.observed_at).toLocaleString()}.
      </p>
    </div>
  );
}
```

`order-fulfillment-history-panel.tsx`:

```tsx
import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface ActiveOrder { po_number: string; quantity: number; quoted_ship_date: string }
interface Fulfillment extends ActiveOrder { actual_ship_date: string }
interface OrdPayload {
  kind: 'direct';
  active_orders: ActiveOrder[];
  recent_fulfillments: Fulfillment[];
  calibrated: { days: number; sample_count: number };
}
interface Props { synthesisMode: WatcherSynthesisMode; payload: OrdPayload | null }

export function OrderFulfillmentHistoryPanel({ synthesisMode, payload }: Props) {
  if (synthesisMode !== 'direct' || payload === null) {
    return <p className="text-sm italic text-slate">Order-history signal not shared.</p>;
  }
  // sample_count is the field to key off: {days: 0, sample_count: 0} means
  // "no observations", never "ships same day" — absence surfaces as absence.
  const hasCalibration = payload.calibrated.sample_count > 0;
  const shown = payload.recent_fulfillments.slice(0, 3);
  return (
    <div className="space-y-1 text-sm">
      <div>
        <span className="text-slate">calibrated</span>{' '}
        {hasCalibration ? (
          <span className="font-medium text-charcoal">
            {payload.calibrated.days}d{' '}
            <span className="text-xs text-slate">({payload.calibrated.sample_count} obs)</span>
          </span>
        ) : (
          <span className="italic text-slate">no observations yet</span>
        )}
      </div>
      <div className="text-xs text-slate">
        {payload.active_orders.length} active order{payload.active_orders.length === 1 ? '' : 's'}
      </div>
      {shown.length > 0 && (
        <ul className="space-y-0.5 text-xs text-charcoal">
          {shown.map((f) => (
            <li key={f.po_number}>
              {f.po_number}: quoted {f.quoted_ship_date} → shipped {f.actual_ship_date}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`soft-quoted-lead-time-panel.tsx`:

```tsx
import type { WatcherSynthesisMode } from '@haiwave/protocol';

interface SqlPayload {
  kind: 'direct';
  days: number | null;
  availability: 'available' | 'partial' | 'unavailable';
  ask_quantity: number;
  resolved_via: 'phantom_demand_bom';
  observed_at: string;
}
interface Props { synthesisMode: WatcherSynthesisMode; payload: SqlPayload | null }

export function SoftQuotedLeadTimePanel({ synthesisMode, payload }: Props) {
  if (synthesisMode !== 'direct' || payload === null) {
    return <p className="text-sm italic text-slate">Soft-quote signal not shared.</p>;
  }
  if (payload.days === null || payload.availability === 'unavailable') {
    return (
      <p className="text-sm text-charcoal">
        Unavailable for {payload.ask_quantity} units — no viable path resolved.
      </p>
    );
  }
  return (
    <div className="space-y-1 text-sm">
      <div>
        <span className="font-medium text-charcoal">{payload.days}d</span>{' '}
        <span className="text-slate">for {payload.ask_quantity} units</span>
        {payload.availability === 'partial' && (
          <span className="text-xs text-warning"> (partial coverage)</span>
        )}
      </div>
      <p className="text-xs text-slate">
        Best-effort, from a phantom-demand traversal — not a committed quote.
        Observed {new Date(payload.observed_at).toLocaleString()}.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run green** — `npm run test -- new-signal-panels` + `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add "src/app/account/sonar/watchers/[id]/_components/order-promise-schedule-panel.tsx" "src/app/account/sonar/watchers/[id]/_components/order-fulfillment-history-panel.tsx" "src/app/account/sonar/watchers/[id]/_components/soft-quoted-lead-time-panel.tsx" "src/app/account/sonar/watchers/[id]/_components/__tests__/new-signal-panels.test.tsx"
git commit -m "feat(sonar): OPS, order-fulfilment, and soft-quote signal panels (#3.1)"
```

---

### Task 19: Wire the panels into `CounterpartiesGrid` — every scoring signal visible

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx` (:296-304 chips, :339-403 per-product cells)
- Test: `src/app/account/sonar/watchers/[id]/_components/__tests__/signal-panel-coverage.test.tsx` (new)

**Interfaces:**
- Consumes: the three panels (Task 18), `signalRow<…>()` (existing), `gapContribution` (existing), `Pill` `signal_type` entries `OPS`/`ORD`/`SQL` (already defined in `pill.tsx`).
- Rendering rule: the three existing panels stay unconditional (their idiom); the three NEW panels are **presence-gated** — a cell renders when the product sub-group has a row of that signal type (a `redacted_gap` row counts as present and renders the honest not-shared line; an unsubscribed signal renders nothing, so legacy lead-time watchers don't grow three noise cells).

- [ ] **Step 1: Write the failing coverage test** (this is the spec §6 named mutation: remove any panel → fails):

```tsx
import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
// TEST value-import: enumerate the protocol's signal types so a 9th signal
// type minted without a panel fails HERE, not in a user's run detail.
import { SignalTypeSchema } from '@haiwave/protocol';
import type { SignalType } from '@haiwave/protocol';
import { CounterpartiesGrid } from '../counterparties-grid';
import { makeResult } from './counterparties-grid.test-fixtures'; // extract the existing factory if it lives inline — see Step 3

// Which rendered panel heading proves each signal type is visible. The three
// lead-time signals roll up into the one Lead time panel by design.
const PANEL_PROOF: Record<SignalType, RegExp> = {
  lead_time_distribution: /Lead time/,
  published_lead_time: /Lead time/,
  quoted_lead_time: /Lead time/,
  capacity_utilization_band: /Available capacity/,
  delivery_event: /Delivery events/,
  order_promise_schedule: /Order promises/,
  order_fulfillment_history: /Order fulfilment/,
  soft_quoted_lead_time: /Soft-quoted lead time/,
};

describe('every scoring signal type has a visible panel', () => {
  for (const signalType of SignalTypeSchema.options) {
    it(`${signalType} renders a panel (gap row form)`, () => {
      const { unmount } = render(
        <CounterpartiesGrid
          results={[
            makeResult({
              signal_type: signalType,
              synthesis_mode: 'redacted_gap',
              payload: null,
              counterparty_name: 'Arno Industrial',
            }),
          ]}
          defaultExpanded
        />,
      );
      expect(screen.getByText(PANEL_PROOF[signalType])).toBeInTheDocument();
      unmount();
    });
  }
});
```

Note: `PANEL_PROOF`'s `Record<SignalType, …>` is itself a compile-time exhaustiveness gate. If the grid requires expansion state to show panels, add a test-only `defaultExpanded?: boolean` prop that seeds `vendorExpanded` with every group key (2 lines) — re-read the expansion mechanics at dispatch and prefer driving the real toggle via `userEvent.click` if simpler.

- [ ] **Step 2: Run red** — OPS/ORD/SQL rows render no panel today.
- [ ] **Step 3: Implement**

Per-product extraction (after the existing `cap`/`del` finds):

```tsx
                    const ops = sub.results.find((r) => r.signal_type === 'order_promise_schedule');
                    const ord = sub.results.find((r) => r.signal_type === 'order_fulfillment_history');
                    const sql = sub.results.find((r) => r.signal_type === 'soft_quoted_lead_time');
                    const opsGap = gapContribution(sub.results, ['order_promise_schedule']);
                    const ordGap = gapContribution(sub.results, ['order_fulfillment_history']);
                    const sqlGap = gapContribution(sub.results, ['soft_quoted_lead_time']);
```

Three new grid cells after the Delivery events cell (same `md:grid-cols-3` grid — they wrap to a second row), each presence-gated:

```tsx
                          {ops && (
                            <div>
                              <h4 className="mb-0.5 flex items-center text-[10px] uppercase tracking-wider text-teal-dark font-semibold">
                                Order promises
                                {opsGap && <GapChip tier={opsGap.tier} points={opsGap.points} />}
                              </h4>
                              <OrderPromiseSchedulePanel
                                {...signalRow<Parameters<typeof OrderPromiseSchedulePanel>[0]>(ops)}
                              />
                            </div>
                          )}
                          {ord && (
                            <div>
                              <h4 className="mb-0.5 flex items-center text-[10px] uppercase tracking-wider text-teal-dark font-semibold">
                                Order fulfilment
                                {ordGap && <GapChip tier={ordGap.tier} points={ordGap.points} />}
                              </h4>
                              <OrderFulfillmentHistoryPanel
                                {...signalRow<Parameters<typeof OrderFulfillmentHistoryPanel>[0]>(ord)}
                              />
                            </div>
                          )}
                          {sql && (
                            <div>
                              <h4 className="mb-0.5 flex items-center text-[10px] uppercase tracking-wider text-teal-dark font-semibold">
                                Soft-quoted lead time
                                {sqlGap && <GapChip tier={sqlGap.tier} points={sqlGap.points} />}
                              </h4>
                              <SoftQuotedLeadTimePanel
                                {...signalRow<Parameters<typeof SoftQuotedLeadTimePanel>[0]>(sql)}
                              />
                            </div>
                          )}
```

Vendor-row chips (extend :296-304 / :318-324):

```tsx
          const hasOPS = g.results.some((r) => r.signal_type === 'order_promise_schedule');
          const hasORD = g.results.some((r) => r.signal_type === 'order_fulfillment_history');
          const hasSQL = g.results.some((r) => r.signal_type === 'soft_quoted_lead_time');
```

```tsx
                  {hasOPS && <Pill category="signal_type" value="OPS" />}
                  {hasORD && <Pill category="signal_type" value="ORD" />}
                  {hasSQL && <Pill category="signal_type" value="SQL" />}
```

If the existing test file's `makeResult` factory is inline, extract it to `__tests__/counterparties-grid.test-fixtures.ts` and import from both test files (pure move, no behavior change).

- [ ] **Step 4: Run green** — `npm run test -- counterparties-grid signal-panel-coverage new-signal-panels` + `npm run build`. Note in the ledger: readiness watchers (scope with `sku_asks`) render `<ReadinessReport>`, not this grid — that surface already shows ORD/SQL; the grid path is the OPS-without-sku_asks fix.
- [ ] **Step 5: Commit**

```bash
git add "src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx" "src/app/account/sonar/watchers/[id]/_components/__tests__/signal-panel-coverage.test.tsx" "src/app/account/sonar/watchers/[id]/_components/__tests__/counterparties-grid.test-fixtures.ts"
git commit -m "feat(sonar): grid renders OPS/ORD/SQL panels — no scoring signal is invisible (#3.1)"
```

---

### Task 20: Backlog filters — two-row layout, partner name-select (#16); Phase-1 gate + PR

**Files:**
- Modify: `src/app/account/sonar/posture/changes/filter-pills.tsx` (whole file, 140 lines)
- Test: `src/app/account/sonar/posture/changes/__tests__/filter-pills.test.tsx` (new; follow the obligations filter-pills test idiom)

**Interfaces:**
- Consumes: `/api/account/partners` (name-resolving select; option value = partner UUID `id`, label = `company_name`); `EVENT_KIND_PILLS`/`KIND_TOOLTIPS` (Task 12's 5-kind set); `<Pill>` (house rule).
- Preserved invariants: URL-param state (`kind` multi-append, `partner`, `from`, `to`, `processed`), `?page` reset on every change, stale-`severity` drop in `setShowing`, server-side allowlist re-application in `page.tsx` (untouched).

Layout (walk ruling verbatim): row 1 = `Showing:` select + From/To dates + Partner select; row 2 = kind pills on their own line. The partner field stops being a raw-UUID paste box.

- [ ] **Step 1: Write the failing test**

```tsx
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/account/sonar/posture/changes',
  useSearchParams: () => new URLSearchParams('page=3'),
}));

const PARTNERS = [
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', company_name: 'MidWest Fastener Corp', status: 'trading_pair' },
];

beforeEach(() => {
  push.mockClear();
  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(PARTNERS), { status: 200 }),
  );
});

import { FilterPills } from '../filter-pills';

describe('Watcher Backlog FilterPills (v1.73 layout)', () => {
  it('partner is a name-resolving select whose value is the partner UUID', async () => {
    const user = userEvent.setup();
    render(<FilterPills />);
    const select = await screen.findByTitle(/filter the feed to changes involving/i);
    await user.selectOptions(select, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(screen.getByRole('option', { name: 'MidWest Fastener Corp' })).toBeInTheDocument();
    expect(push).toHaveBeenCalledWith(
      expect.stringContaining('partner=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    );
    // Filter change resets pagination.
    expect(push).toHaveBeenCalledWith(expect.not.stringContaining('page=3'));
  });
  it('kind pills sit on their own row below the showing row', async () => {
    render(<FilterPills />);
    const kindRow = (await screen.findByText('Kind:')).closest('div');
    const showingRow = screen.getByText('Showing:').closest('div');
    expect(kindRow).not.toBe(showingRow);
  });
  it('kind toggles render through <Pill> (house rule) and keep aria-pressed', async () => {
    const user = userEvent.setup();
    render(<FilterPills />);
    const pill = await screen.findByRole('button', { name: /lead time degraded/i });
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    expect(pill.querySelector('[data-testid="pill"]')).not.toBeNull();
    await user.click(pill);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('kind=lead_time_degraded'));
  });
});
```

- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement** — restructure the return into two wrap-rows and swap the partner input:

```tsx
  const [partners, setPartners] = useState<Array<{ id: string; company_name: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/partners');
        if (!res.ok) return; // degraded: the select still offers "All partners"
        const body = (await res.json()) as Array<{ id: string; company_name: string }>;
        if (!cancelled) setPartners(body);
      } catch {
        /* degraded lane: no options beyond All partners; URL param still honored */
      }
    })();
    return () => { cancelled = true; };
  }, []);
```

```tsx
  return (
    <div className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="self-center text-xs uppercase tracking-wider text-slate">Showing:</span>
        {/* existing showing <select> unchanged */}
        <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">From:</span>
        {/* existing from input */}
        <span className="self-center pl-2 text-xs uppercase tracking-wider text-slate">To:</span>
        {/* existing to input */}
        <span className="self-center pl-4 text-xs uppercase tracking-wider text-slate">Partner:</span>
        <select
          value={partner}
          onChange={(e) => setParam('partner', e.target.value)}
          title="Filter the feed to changes involving a specific counterparty."
          className="rounded-md border border-slate/30 px-2 py-1 text-xs"
        >
          <option value="">All partners</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>{p.company_name}</option>
          ))}
          {/* A partner already pinned in the URL but absent from the list
              (e.g. haiCore degraded) stays selectable so the filter is honest. */}
          {partner && !partners.some((p) => p.id === partner) && (
            <option value={partner}>{partner.slice(0, 8)}… (unresolved)</option>
          )}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="self-center text-xs uppercase tracking-wider text-slate">Kind:</span>
        {EVENT_KIND_PILLS.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={isKindActive(kind)}
            onClick={() => toggleKind(kind)}
            className="group"
          >
            <Pill
              category="change_kind"
              value={kind}
              definition={KIND_TOOLTIPS[kind]}
              tone={isKindActive(kind) ? 'info' : 'neutral'}
              className={isKindActive(kind) ? 'ring-1 ring-teal' : 'group-hover:ring-1 group-hover:ring-slate/40'}
            >
              {kind.replace(/_/g, ' ')}
            </Pill>
          </button>
        ))}
      </div>
    </div>
  );
```

(`children` keeps the lowercase label the e2e 16.2 pin expects; `definition` carries the click-to-filter tooltip so `<Pill>`'s map lookup isn't consulted for the action copy. Add `import { Pill } from '@/components/pill';` and `useEffect, useState` imports.)

- [ ] **Step 4: PHASE 1 FULL GATE**

```bash
npm run build && npm run test && npm run lint
grep -rn "/account/sonar/watcher/dashboard" src e2e | grep -v decline-dialog  # must be empty
```

If a dev stack is up (haiWeb :3001 + haiCore :3000, `ENABLE_TEST_SEED=true`), run `npm run test:e2e`; otherwise the walk runs at owner-walk time — say which happened in the checkpoint report, never imply the walk ran if it didn't.

- [ ] **Step 5: Commit, push, open the PR (never merge)**

```bash
git add src/app/account/sonar/posture/changes/filter-pills.tsx src/app/account/sonar/posture/changes/__tests__/filter-pills.test.tsx
git commit -m "feat(sonar): backlog filters — two-row layout, partner name-select, pills through <Pill> (#16)"
git push -u origin v1.73-wp4
gh pr create --repo simmysam3/haiWeb --base master --head v1.73-wp4 --title "v1.73 WP4 Phase 1: Sonar IA + naming, panels, picker, three-state identity" --fill
```

PR body must carry the deviations ledger (this plan's section) verbatim and the walk checklist (below). Checkpoint to the orchestrator; the owner walks the OPEN PR (WP2 pattern) and merges.

---

## Phase 2 — Ruling-4 alias rider (SEVERABLE; protocol 3.67.0)

**HARD ENTRY GATE (Task 21 Step 1): do not create worktrees, files, or branches until it passes.** If WP3 slips indefinitely, Phase 1 ships alone and this phase waits — that is the designed outcome, not a failure.

### Task 21: Gate verification + rider worktrees

**Files:**
- Create: worktrees `~/dev/hw/haiCore-v173-wp4` (branch `v1.73-wp4-alias` off haiCore main-holder), `~/dev/hw/haiWeb-v173-wp4-alias` (branch `v1.73-wp4-alias` off haiWeb master, post-Phase-1 merge)

- [ ] **Step 1: Verify the gate AT THE FILES (confirmation ≠ landed)**

```bash
cd ~/dev/hw/haiCore && git fetch origin
git show origin/main:packages/protocol/package.json | grep '"version"'   # MUST be exactly 3.66.0
git log --oneline -3 origin/main                                          # WP3 merge visible
cd ~/dev/hw/haiWeb-v169-mrp && git fetch origin && git log --oneline -2 origin/master  # Phase 1 merged
```

If protocol is NOT 3.66.0: STOP, report to the orchestrator (agent1) — if it is 3.65.0 only (WP1 landed, WP3 not), the rider stays queued; if it is above 3.66.0, the 3.67.0 allocation is stale — renumber through the orchestrator before any mint.

- [ ] **Step 2: Create worktrees** off the CURRENT main-holders (re-confirm which checkout holds haiCore main at dispatch — `git worktree list` in `~/dev/hw/haiCore`; it was `haiCore-v166-agent2` at plan time). Protocol build first (worktree protocol): run the protocol package build in the haiCore worktree before any test.
- [ ] **Step 3: Baseline gates** — haiCore: protocol suite + `apps/core` tests green from `apps/core/`; haiWeb: build + vitest green.

### Task 22: Protocol 3.67.0 — `supplier_alias` on `WatcherResult`

**Files (haiCore worktree; all pins RE-GREPPED at dispatch — WP3 moved them):**
- Modify: `packages/protocol/src/watcher/result.ts` (`WatcherResultSchema`), `packages/protocol/src/version.ts` (`PROTOCOL_VERSION` + changelog block), `packages/protocol/package.json` (version), `docs/regression-test-plan.md` (current-version line)
- Modify: every test pinning the previous version literal — enumerate with `git grep -n "3\.66\.0" -- packages/protocol` (at plan time the 3.64.0 pin surface was 17 literals across 10 test files + package.json + version.ts; WP3 will have moved the same set to 3.66.0)
- Test: `packages/protocol/src/watcher/__tests__/supplier-alias.test.ts` (new)

**Three-category mint enumeration (WP1 discipline, carried):**
1. **SSOT + test pins:** `package.json` / `version.ts` / every `expect(PROTOCOL_VERSION).toBe(...)` literal — the re-grep above is the list; miss one and the suite fails loudly (good), but enumerate FIRST so the count is known before editing.
2. **Cross-repo consumers:** haiWeb consumes via symlink (types flow on rebuild — run the protocol package build in the haiCore worktree; haiWeb needs no code change for the schema itself). haiCore runtime consumes protocol **dist** — after this lane MERGES, rebuild dist in the runtime checkout (the vendored-protocol-drift lesson).
3. **haiClient vendored copy: deliberately untouched.** Additive optional field + minor bump; the compat gate is major-only (`plugins/protocol-version.ts`). The next haiClient sync inherits 3.67.0 — note it in the PR body so no one "helpfully" syncs mid-flight.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest';
import { PROTOCOL_VERSION } from '../../version.js';
import { WatcherResultSchema } from '../result.js';

describe('3.67.0 — WatcherResult.supplier_alias (v1.73 WP4)', () => {
  it('protocol is 3.67.0', () => {
    expect(PROTOCOL_VERSION).toBe('3.67.0');
  });
  it('accepts an optional run-scoped alias on sub-tier rows', () => {
    const base = {
      result_id: '11111111-1111-1111-1111-111111111111',
      run_id: '22222222-2222-2222-2222-222222222222',
      counterparty_participant_id: null,
      signal_type: 'lead_time_distribution',
      synthesis_mode: 'aggregated_derivative',
      payload: { kind: 'aggregated', median_p50: 4, median_p90: 9, source_responder_count: 2 },
      gap_reason: null,
      observed_at: '2026-08-01T00:00:00.000Z',
      tier: 2,
      aggregated_under_tier_1: '33333333-3333-3333-3333-333333333333',
      external_product_id: null,
    };
    expect(WatcherResultSchema.parse({ ...base, supplier_alias: 'A' }).supplier_alias).toBe('A');
    // Backward compatible: absent stays absent (every pre-3.67 row parses).
    expect(WatcherResultSchema.parse(base).supplier_alias).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run red** (from the protocol package; version pin + unknown key strictness as applicable).
- [ ] **Step 3: Implement** — in `WatcherResultSchema` after `aggregated_under_tier_1`:

```ts
  // 3.67.0 (v1.73 WP4): run-scoped display alias (A, B, …) for sub-tier
  // aggregate rows, mirroring VendorLine.supplier_alias (bom/bom-tree.ts).
  // Minted centrally at serve time per aggregated_under_tier_1 cluster —
  // stable within this run only, never matchable across runs or by other
  // buyers (the VerifiedUndisclosedChip tooltip's exact promise). Absent on
  // direct rows and on rows served by pre-3.67 cores.
  supplier_alias: z.string().min(1).max(4).optional(),
```

Bump `PROTOCOL_VERSION`/package.json to `3.67.0`; add the version.ts changelog block ("3.67.0 (v1.73 WP4): ADDITIVE — WatcherResult.supplier_alias, serve-time run-scoped alias for sub-tier watcher rows. Backward-compatible."); move every re-grepped test literal to `3.67.0`; update `docs/regression-test-plan.md`'s current-version line.

- [ ] **Step 4: Run the FULL protocol suite green** (from `packages/protocol`), then the full haiCore gate from `apps/core/`.
- [ ] **Step 5: Commit** — `feat(protocol): 3.67.0 — WatcherResult.supplier_alias (run-scoped, additive)`

### Task 23: haiCore serve-time mint — one central site

**Files (haiCore worktree; re-grep exact names at dispatch):**
- Create: `apps/core/src/services/run-scoped-alias.ts` (extract `nextAlias`/`aliasFor` from `bom-loader/redact-tree.ts:91-103`; redact-tree imports them — pure move, its tests stay green)
- Modify: the watcher run read path — the service method behind `GET /watcher/runs/:id` (`routes/watcher.ts:84` serves `results: result.results`; locate the service that assembles `result.results` and mint there, immediately before the rows leave the service)
- Test: beside the modified service (`__tests__`), following its existing test idiom

**Interfaces:**
- Produces: every served sub-tier row (`counterparty_participant_id === null`) carries `supplier_alias`; rows in the same `aggregated_under_tier_1` cluster share one letter; letters follow first-encounter order over rows sorted by `(observed_at, result_id)` — the sort makes the mint deterministic across reads, which is what makes a serve-time alias "stable within this run" without persisting anything (zero migrations).
- Mint helper shape (from redact-tree, now shared):

```ts
export function nextAlias(n: number): string; // 0→A … 25→Z, 26→AA
export function aliasFor(aliases: Map<string, string>, key: string): string;
```

- [ ] **Step 1: Failing test** — same cluster ⇒ same letter; two clusters ⇒ A then B; direct rows ⇒ undefined; two consecutive reads ⇒ identical aliases.
- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement** in the results-serving method:

```ts
    // 3.67.0 (v1.73 WP4): run-scoped supplier aliases for sub-tier rows.
    // Serve-time, deterministic — sort fixes first-encounter order, the map
    // keys on the tier-1 path cluster, nothing is persisted (zero-migration).
    const sorted = [...rows].sort(
      (a, b) => a.observedAt.localeCompare(b.observedAt) || a.resultId.localeCompare(b.resultId),
    );
    const aliases = new Map<string, string>();
    for (const row of sorted) {
      if (row.counterpartyParticipantId !== null) continue;
      row.supplierAlias = aliasFor(aliases, row.aggregatedUnderTier1 ?? row.resultId);
    }
```

(Adapt field casing/assembly to the service's actual row mapping at dispatch — the snippet states the algorithm; the service's own row-to-API mapping carries it into `supplier_alias`.)

- [ ] **Step 4: Run green** — service tests + full haiCore gate from `apps/core/`.
- [ ] **Step 5: Commit** — `feat(watcher): serve-time run-scoped supplier aliases on sub-tier result rows (3.67.0)`

### Task 24: haiWeb — the grid letters light up

**Files (haiWeb rider worktree):**
- Modify: `src/app/account/sonar/watchers/[id]/_components/counterparties-grid.tsx` (Task 17's `alias: null` line)
- Test: extend `__tests__/counterparties-grid.test.tsx`

- [ ] **Step 1: Failing test** — a sub-tier fixture row with `supplier_alias: 'A'` and a named tier-1 parent renders `Supplier A` inside the chip and the parent prefix beside it (`Arno Industrial + … Supplier A`); a row without the field still renders `Identity withheld`.
- [ ] **Step 2: Run red.**
- [ ] **Step 3: Implement** — in the group build, replace `alias: null` with:

```tsx
                alias: r.supplier_alias ?? null,
```

(`EnrichedWatcherResult` inherits the field from the updated protocol types via the symlink — verify `node_modules/@haiwave/protocol` resolves to a checkout containing 3.67.0 before running; rebuild the protocol package if types don't flow.)

- [ ] **Step 4: Run green** + `npm run build`.
- [ ] **Step 5: Commit** — `feat(sonar): undisclosed grid clusters render their run-scoped Supplier letter (Ruling 4)`

### Task 25: Rider gates, PRs, register row

- [ ] **Step 1:** Full gates in both worktrees (haiCore: protocol suite + apps/core from `apps/core/`; haiWeb: build + vitest + lint).
- [ ] **Step 2:** Open PRs — **haiCore first**, then haiWeb; cross-link them; both PR bodies state the severability ("haiWeb PR depends on haiCore PR; merge haiCore first; rebuild protocol dist in the runtime checkout after merge") and the haiClient note from Task 22.
- [ ] **Step 3:** Security register: if the owner rules that the three-state/mock pinning or the alias disclosure surface warrants a register row, the ORCHESTRATOR allocates the D-number at write time (re-grep the tail; escape any literal `|` inside backticks as `\|` — the D-132 lesson). The implementer never invents a D-number.
- [ ] **Step 4:** Checkpoint report; the owner walks both PRs; the implementer never merges.

---

## Walk plan (owner account, running dev stack — each row names which account sees what)

1. **Owner account** — Sonar nav reads as two surfaces: Sonar Observe = Dashboard · Phantom Demand · Watchers · Watcher Backlog · Grounded Forecasts · Request Management; no "Watcher Management", no Sonar Dashboard under Account Management.
2. **Owner** — Sonar Dashboard → Activity: clicking an audit run lands on `/account/sonar/audit/<that run>`; a watcher run lands on `/account/sonar/watchers/<that run>`.
3. **Owner** — `/account/sonar/watcher/dashboard` → 308 → Watchers list.
4. **Owner** — a watcher run detail with OPS (and/or ORD/SQL) results shows the new panels; a gap row reads "not shared"; the vendor row shows OPS/ORD/SQL pills.
5. **Owner** — a run with sub-tier aggregates: each redacted cluster reads `<tier-1 name> + [Identity withheld]` (Phase 1) / `<tier-1 name> + [✓ Supplier A]` (after the rider).
6. **Owner** — watcher wizard scope picker lists active trading pairs with ZERO audit history; empty-pair account sees the Partners-pointing empty state, no nomination ceremony.
7. **Owner** — with a jailed agent (stop one fleet agent): dashboard alert names it and links to `/account/agents`.
8. **Owner** — Watcher Backlog: two-row filter layout; partner select shows names; kind pills on their own row; 5 pills including `upstream risk reported` (dormant — filtering on it returns an empty feed until 3.66.0 data exists).

## Execution Handoff

Plan complete. Execution mode is the OWNER's call after plan review (agent6 lane likely — orchestrator asks). Options: **1. Subagent-Driven** (superpowers:subagent-driven-development — fresh subagent per task, two-stage review; the WP1/WP3 pattern) or **2. Inline** (superpowers:executing-plans). Phase 2 additionally waits on its Task 21 gate regardless of mode.
