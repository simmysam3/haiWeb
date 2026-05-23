# Backlog IA Restructure — Design

**Date:** 2026-05-23
**Repo:** HaiWeb (+ haiCore for one new endpoint)
**Cycle:** v.1.41 test-fix
**Surfaces:** `/account/sonar/posture/*` → renames + restructure, sidebar nav
**Status:** Spec (brainstorming complete, awaiting approval)

## Problem

The Sonar Observe → **Posture** section conflates measurement framing
with action framing, mirroring the conceptual job of Sonar Audit and
muddying the section's identity. Inside the section, the **Working list**
landing is a unified-view-with-pill-filters that doesn't function: pill
filtering to Obligations returns empty and forces the user to click the
Obligations tab anyway. The **Watchers** tab houses run history + trigger
controls, which is *configuration / monitoring meta-activity*, not work
items — it sits awkwardly next to Events and Obligations which are
action-queue surfaces.

Goal: rename the section to communicate its action purpose, drop the
non-functional unified view, lift each backlog category to a first-class
mode, and relocate Watchers to where it conceptually belongs.

## Decisions (resolved during brainstorming)

1. **Section rename.** Sidebar label `Posture` → **`Backlog`**. URL stays
   `/account/sonar/posture/*` for this iteration (label-only test before
   committing to URL churn + 301 redirects + spec / as-built rewrites).
2. **Drop the "Working list" tab.** The section root *is* the backlog
   landing. A tab labeled "Working list" inside the Backlog section
   restates the URL.
3. **Tabs become mode-switches, not filters.** No unified default view.
   The three modes are independent surfaces; the user picks which
   backlog category they're working in:
   - **Gaps** (was Working list, now category-scoped to `gap`)
   - **Events** (current Changes tab, category `change` + `expiry`)
   - **Obligations** (category `obligation`)

   Each mode owns its own filter set / columns / sort. No cross-mode
   "All" view.
4. **Default landing = Events.** Clicking `Backlog` in the sidebar lands
   on Events (matches what the sidebar badge counts).
5. **Backlog badge = Events count only.** The sidebar entry shows a
   count badge for unread/recent change events. Gaps are intentionally
   excluded (volume in the hundreds/thousands, low per-item signal —
   would drown the badge). Obligations are intentionally excluded (see
   §6).
6. **Overdue obligations do NOT contribute to the badge.** Overdues are
   "I should manage it, but if I don't get to it till tomorrow we are
   not going to stop the production line." They sit silently in the
   Obligations tab; users navigate there when they choose.
7. **Watchers relocated.** Out of the Backlog section entirely. New
   nav home: `Sonar Observe → Watcher Management` (label confirmed —
   *Management* covers both the run-history surface and the trigger /
   schedule controls; *Config* would undersell the historical view).
8. **Gaps mode gets a trending header strip.** Gaps view cannot just be
   a list of N hundred items — by the user's own framing, individual
   gaps are not actionable signal, the only useful signal is "am I
   reducing them over time?" The Gaps mode therefore opens with:
   `342 open gaps · ↓ 68 vs last week` plus a small 4-week sparkline.
   List below.

## Decisions (resolved during open-questions pass)

9. **Category mapping resolved.** Protocol has 5 working-list categories
   (`gap`, `change`, `nomination`, `obligation`, `expiry`). Mapping:
   - `gap` → Gaps mode
   - `change` + `expiry` → Events mode
   - `obligation` → Obligations mode
   - `nomination` → **NOT in Backlog.** Nominations are outgoing
     requests awaiting the counterparty's response, which is
     conceptually the outbound counterpart to obligations and belongs
     in Request Management's outbound view, not the Backlog action
     surface. If Request Management doesn't already surface
     nominations, that's a follow-up — out of scope here.
10. **Gaps trend data source — prefer derivation, build new endpoint
    only if necessary.** Investigate first whether `compliance_snapshots`
    (v1.34 Phase 4) captures enough state to derive a daily/weekly
    gap-count series from snapshot history. If yes, expose via a new
    haiCore route that reads existing snapshot data (no new storage).
    If snapshots don't carry per-snapshot gap counts, add a new
    endpoint backed by either a new lightweight aggregate table or
    on-demand computation. **The trend ships in PR-6 of this cycle**
    — not deferred to v.1.42. The Gaps mode is incomplete without it
    by the user's own framing ("list of N hundred items is not useful
    without trend").
11. **Backlog badge polling — drop the refresh interval.** Events
    surface ecosystem-wide changes that update at most nightly
    (per the gap-update cadence; no known higher-frequency event
    source). Real-time polling would add request volume for no signal.
    `BacklogNavItem` uses SWR's default revalidation (on mount, on
    focus, on reconnect) with NO `refreshInterval`. Users who want a
    live update can refresh the page. Departs from
    `RequestManagementNavItem`'s 15s cadence — bilateral requests
    genuinely arrive throughout the day; change events do not.

## Component / file-by-file plan

### Sidebar nav (`src/components/account-nav.tsx`)

- Sonar Observe section: rename item label `"Posture"` → `"Backlog"`.
  `href` stays `/account/sonar/posture`.
- Add new Sonar Observe item `"Watcher Management"`,
  `href: /account/sonar/watchers`.
- Add `BacklogNavItem` component (mirrors `RequestManagementNavItem`)
  that fetches a count endpoint and renders `<NavBadge>` next to the
  label. Use `jsonFetcher` (per PR #64 fix). **No `refreshInterval`**
  — SWR default revalidation only (per Decision 11).
- Update the `v.1.41:` comment block in the Sonar Audit section
  (already touched by PR #63) — no, this is a separate section, no
  edit needed there.

### Backlog section layout (`src/app/account/sonar/posture/`)

```
posture/
  _components/
    posture-tabs.tsx          RENAME → backlog-tabs.tsx; drop "Working list" tab;
                              tabs become [Events, Gaps, Obligations] in that
                              left-to-right order; "Watchers" tab REMOVED;
                              "Events" tab unchanged label; "Working list" tab
                              renamed → "Gaps"; "Obligations · Inbound" → "Obligations".
    backlog-default-redirect.tsx
                              NEW  client component or middleware decision —
                              section root redirect to /posture/changes (Events).
                              Simpler: change page.tsx to render ChangesPage
                              instead of WorkingListPage.
  page.tsx                    EDIT  default landing now renders Events surface
                              (re-export ChangesPage instead of WorkingListPage).
                              Comment refreshed to explain the new contract.
  working-list/
    page.tsx                  EDIT  remove "Working list" framing from H1 + intro;
                              becomes the canonical Gaps mode page (category
                              hard-scoped to 'gap'; expiry/nomination/obligation
                              filter pills removed from filter-pills.tsx).
    gaps-trend-strip.tsx      NEW  header strip rendering current count + delta
                              vs N-day-ago + small sparkline. Sources:
                              /api/account/sonar/coverage/trend (interim) or
                              new gap-count-trend endpoint (preferred — see Q2).
    filter-pills.tsx          EDIT  remove cross-category pills (since mode is
                              hard-scoped to gap). Keep within-gap filters
                              (status, partner, sort).
  changes/                    (untouched as a surface — already Events)
  obligations/
    page.tsx                  EDIT  cosmetic: H1 from "Obligations · Inbound"
                              to "Obligations"; intro refreshed.
  runs/                       DELETE  moved to /sonar/watchers (see below).
                              Add 301 redirect from /posture/runs to /sonar/watchers.
  trust-bypass/               KEEP as-is for now — flag as
                              out-of-scope. Could move to Watcher Management
                              or Configurations in a follow-up cycle.
```

### Watcher Management section (`src/app/account/sonar/watchers/`)

```
watchers/
  page.tsx                    NEW  surface contents identical to current
                              /posture/runs/page.tsx but with title
                              "Watcher Management" + intro explaining the
                              relocation rationale.
  runs-table.tsx              MOVE from posture/runs/runs-table.tsx
  run-controls.tsx            MOVE from posture/runs/run-controls.tsx
```

### Redirects (`src/proxy.ts`)

- `/account/sonar/posture/runs` → `/account/sonar/watchers` (301)
- `/account/sonar/posture/working-list` → `/account/sonar/posture/working-list`
  (no change; canonical)
- Note: section root `/account/sonar/posture` now renders Events. No
  redirect needed because the URL hasn't changed; users with bookmarks
  to `/posture` will land on Events instead of Working list. **Document
  in PR body as user-visible behavior change.**

### Layout shared chrome (`src/app/account/sonar/posture/layout.tsx`)

- No structural change; `CoverageHeaderStrip` and `BacklogTabs` (renamed
  from `PostureTabs`) still render. Coverage strip stays valuable across
  all three modes.

### BFF — new endpoints

- `src/app/api/account/sonar/backlog/events-count/route.ts` NEW — proxies
  to haiCore for the events count used by the sidebar badge. Decide in
  PR-3 between reusing the existing changes feed with a count-only
  flag vs a dedicated count route.
- `src/app/api/account/sonar/working-list/gap-count-trend/route.ts` NEW
  (PR-6) — proxies the gaps trend endpoint.

### haiCore — new endpoints

- PR-3: `GET /api/v1/sonar/compliance/changes/count` (or a count-only
  flag on the existing changes feed). Small additive, no protocol bump.
- PR-6: `GET /api/v1/sonar/working-list/gap-count-trend?window=4w&bucket=day`.
  Implementation note: investigate snapshot-based derivation first
  (no schema change preferred) — see Decision 10.

### Tests

- `src/components/__tests__/account-nav.test.tsx` — assert new Backlog
  + Watcher Management entries, badge wiring.
- `src/app/account/sonar/posture/__tests__/backlog-tabs.test.tsx`
  (renamed) — assert three tabs only, no Working list, no Watchers.
- `src/app/account/sonar/posture/working-list/__tests__/gaps-trend-strip.test.tsx`
  NEW — basic render + delta-formatting.
- `src/app/account/sonar/watchers/__tests__/page.test.tsx` NEW —
  smoke render of relocated runs surface.
- Update any existing test that asserts `/posture` lands on Working List.

## Out-of-scope / deferred

- **URL rename** `/posture` → `/backlog`. Hold for a future cycle once
  the label has been lived with for a few days.
- **`trust-bypass` relocation.** Currently a Posture child page. Doesn't
  fit Backlog cleanly (it's policy config). Leave as-is for now; flag
  for next pass.
- **Configurations section restructure.** Watcher Management joining
  Sonar Observe adds a 6th entry. Approaching the limit before
  subgrouping is needed, but not addressing here.
- **Phantom Demand badge.** Same single-fetcher antipattern likely
  exists elsewhere in sidebar; not in scope.

## PR breakdown (proposed, all into `v.1.41`)

Lockstep where indicated; each PR small and reviewable on its own.

1. **PR-1: Spec doc commit** — this file. Cheap landing for review
   anchor.
2. **PR-2 (HaiWeb): Sidebar rename + Backlog badge wiring.**
   - `account-nav.tsx`: rename Posture→Backlog, add BacklogNavItem,
     add Watcher Management entry.
   - BFF route for events count (interim: client-side count off the
     existing changes feed; revisit after haiCore endpoint lands).
   - No tab / page changes yet. Verifies the label/badge concept.
3. **PR-3 (haiCore + HaiWeb LOCKSTEP): Backlog events count endpoint.**
   - haiCore: add `GET /api/v1/sonar/compliance/changes/count` (or
     count-only flag on existing route).
   - HaiWeb: switch BacklogNavItem to use the new endpoint.
4. **PR-4 (HaiWeb): Tabs restructure + Events default landing.**
   - Rename `PostureTabs` → `BacklogTabs`; drop Working list tab;
     remove Watchers tab; rename remaining tabs per §3.
   - `posture/page.tsx`: re-export Events page (was Working List).
   - `posture/obligations/page.tsx`: rename H1/intro.
   - `posture/working-list/page.tsx`: lock to `category=gap`; remove
     cross-category filter pills.
   - Tests updated.
5. **PR-5 (HaiWeb): Watcher Management relocation.**
   - New `/sonar/watchers/` surface (move files from `posture/runs/`).
   - Delete `posture/runs/`.
   - 301 redirect `/posture/runs` → `/sonar/watchers` in `proxy.ts`.
6. **PR-6 (haiCore + HaiWeb LOCKSTEP): Gaps trend endpoint + trend
   strip component.**
   - haiCore: investigate `compliance_snapshots` first — if
     per-snapshot gap counts are already capturable from existing
     state, expose via a read-only endpoint with no schema change.
     Otherwise add minimal aggregate (decision in the PR, not the
     spec).
   - HaiWeb: `gaps-trend-strip.tsx` + integration into Gaps page.
   - Ships in this cycle — Gaps mode is incomplete without it
     (per Decision 10).

## Backward-compat checklist

- `/account/sonar/posture` URL preserved.
- `/account/sonar/posture/working-list` URL preserved (canonical Gaps
  page).
- `/account/sonar/posture/changes` URL preserved (canonical Events page).
- `/account/sonar/posture/obligations` URL preserved.
- `/account/sonar/posture/runs` 301 → `/account/sonar/watchers`.
- Bookmarks to bare `/posture` now land on Events instead of Working
  list — **user-visible behavior change, document in PR-4**.
- Deep links from outside (Sonar Dashboard, email alerts, etc.) — audit
  in PR-4 before merge.

## Memory / docs touchpoints (post-merge)

- `MEMORY.md`: add a one-liner under "v1.41" pointing at this spec +
  shipped PR set.
- as-built (`haiCore/docs/<date>_as_built.md`): note the IA rename and
  Watcher relocation in the next as-built sweep.
- `haiCore/docs/haiweb-account-requirements*.md`: scan for
  `Posture` references that need updating.
