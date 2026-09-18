# v1.101 Safe Room — L7: HaiWeb Console Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status — AMENDED 2026-09-18 after the READ-ONLY pre-flight scan.** This copy, on branch `v1101-L7-console` in `/Users/samfleming/dev/hw/haiWeb-v1101-L7`, is the **plan of record** for the lane; the copy on haiCore `main` is superseded and must not be executed. Sources: the scan at `.superpowers/sdd/2026-09-18-v1101-L7-console/preflight-scan.md` (925 lines) and the controller's binding rulings in `/Users/samfleming/dev/hw/SDD-LEDGER-2026-09-18-v1101-L7.md`. Every haiCore wire shape below is the **as-built** `main` at `16b31655756397379226c86a86a4092d28492f96`; every haiWeb `path:line` is measured at `61b201fc549bc17742ff229ab3ea8b9cb90b4408`.

**Finding-id convention.** Pre-flight findings are written **PF P1 … PF P32** and rulings **Q1 … Q6**. They are a DIFFERENT numbering from the spec's own ruling ids that this plan already cited (the "ruling P8" below and the "P6" in Task 7), which are untouched.

**Goal:** Ship the six v1.101 console surfaces in `haiWeb` (disclosure policy matrix, premier designation, trading-pair activation, inquiry log, configuration packs, registry proposals) plus D-211 role-gate coverage for every new mutation route — with no ask composer (ruling P8 — the spec's own id, not a pre-flight finding). Two amendments change the shape of the work: **Task 0** (ARIA on the shared `Tabs` component) is new and precedes every surface batch, and **Task 12** (the admin proposal queue) is **CUT** from this lane — see its heading and `## Execution order`.

**Architecture:** Every surface follows the codebase's BFF pattern: a thin `route.ts` under `src/app/api/account/` (or `src/app/api/admin/`) wrapped in `withHaiCore`, proxying a new haiCore v1.101 endpoint via `client.fetchRaw(path, init)` — the `obligations/[id]/accept` idiom — then a server-component page calling `fetchBffJson`, handing data to a small client component. Every shared wire-shape type lives in `src/lib/safe-room-types.ts`, extended task by task — **except** the inquiry verdict union, the attribute-class row and the pack figures, which are imported from `@haiwave/protocol` rather than re-declared (**PF P7**, **PF P11**, **PF P16**, **PF P18**); `TrustClass` is imported from `@haiwave/protocol` (already shipped). A shared `forwardHaiCoreResponse` helper (Task 1) replaces the repeated parse-and-passthrough block every route would otherwise duplicate, and carries the **204 branch** of the idiom it copies (**PF P27**).

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, vitest (jsdom, `retry: 2`), `@haiwave/protocol` via `file:../haiCore/packages/protocol`.

**Spec (PF P25):** `/Users/samfleming/dev/hw/haiCore-v1101-L3/docs/superpowers/specs/2026-09-16-safe-room-qualified-inquiry-design.md` — **READ-ONLY**, canonical at `16b31655`. The worktree copy this plan cited before the amendment is 75 lines stale (it predates L0b's closed unit vocabulary and migration 0052); because this plan cites the spec only by section number, no line number here depended on it. Implements §11 (Console Surfaces). Also read §3.2–3.3 (premier + D-146), §4.1–4.3 (registry), §5 (disclosure policy), §6.4 (verdict shape), §10.6 (packs).

## Pre-flight amendment record

Applied 2026-09-18 by the plan-amender on `61b201fc`. Ids are the pre-flight scan's; the rulings are the controller's (ledger `/Users/samfleming/dev/hw/SDD-LEDGER-2026-09-18-v1101-L7.md`, table "Pre-flight scan … ruled"). This record names what changed and where; the amendment itself lives at the task, tagged with the same id.

| Id | Class | Applied in | What the amendment did |
|---|---|---|---|
| PF P1 | LB | Task 13 Step 1 | the eight route entries import one directory up, as the cited precedent does |
| PF P2 | LB | Tasks 4 and 11 (required), and every other test that mocks the auth module | the auth mock uses the real role ladder, as Task 3 already did, so the 403 arm can fail; applied lane-wide because the weaker mock can only ever hide a gate |
| PF P3 | LB | Tasks 1, 2 | the disclosure-policy read envelope, row shape and source union come from the as-built wire |
| PF P4 | LB | Tasks 1, 2 | room participation is its own GET returning an object; Task 1 adds the route, Task 2 fetches it |
| PF P5 | LB | Tasks 1, 2 | the shortfall flag is per cell; every save sends the whole cell; a red pins that a disclosure change preserves it |
| PF P6 | LB | Tasks 1, 2 | the per-counterparty override is a separate control keyed (counterparty × class); uuid fixtures; a red pins the key that must not be sent |
| PF P7 | LB | Tasks 1, 2, 11 | the attribute-class read envelope and row type come from the wire and the protocol |
| PF P8 | LB | Task 11 | the propose form grows to the fifteen required keys, typed against the protocol, with both refinements mirrored |
| PF P9 | LB | Task 11 | the proposal row is declared from the haiCore route-layer type, with its source file named |
| PF P10 | LB | Task 12 | CUT — no admin list route exists upstream (Q1) |
| PF P11 | LB | Tasks 9, 10 | the pack config type takes the as-built figures and ceiling |
| PF P12 | LB | Task 10 | the comparison table renders through one typed formatter per key, with no cast; a red pins a formatted object figure |
| PF P13 | LB | Task 5 | the two inert arms are stated in the task text; BFF and UI ship as planned (Q1) |
| PF P14 | LB | Task 0 | NEW task — ARIA on the shared tabs component, one red first (Q4) |
| PF P15 | LB | Tasks 6, 7, 8 | the BFF maps an upstream 403 to a fixed not-enabled state, pinned by a red; the realm grant is an owner item (Q3) |
| PF P16 | LB | Tasks 6, 8 | the verdict union is imported from the protocol and branched per member |
| PF P17 | LB | Task 8 | the raw-value panel is deleted (D-222) and replaced by one sentence; a red pins its absence with a present control |
| PF P18 | I | Tasks 6, 8 | the four hand-rolled protocol types are replaced by L0's exports |
| PF P19 | I | Task 6 | the unit field survives, because the type is imported rather than restated |
| PF P20 | I | Tasks 6, 7 | the list row's outcome is nullable and the table renders a dash for it |
| PF P21 | I | Task 7 | guard trip is an inbound-only indicator column; a red pins its absence on the outbound tab |
| PF P22 | I | Task 4 | the decline-activation fixture takes the as-built response shape |
| PF P23 | I | Tasks 2, 7 | both local label copies are deleted in favour of the one shared module |
| PF P24 | I | Tasks 1, 2 | the overrides GET route is added and read by the counterparty view, so inherited and overridden cells are distinguishable |
| PF P25 | I | header | the spec citation points at the canonical copy |
| PF P26 | I | Global Constraints | the protocol pin: never install, and a pin check first in every gate |
| PF P27 | I | Task 1 | the forwarding helper carries the 204 branch; a red covers it |
| PF P28 | I | Task 13 | the admit arm asserts the upstream call as well as the status (Q6) |
| PF P29 | m | Global Constraints | the library-tier citation is widened to the line the sentence is about |
| PF P30 | m | Task 5 | the already-proposed block citation is corrected |
| PF P31 | m | Task 1 | the api-prefix citation names the constant that actually carries it |
| PF P32 | m | Global Constraints, every Step 5 | authorship trailer, and every commit takes its message from a file |

Rulings applied (ledger, binding):

- **Q1 (PF P10, PF P13)** — Task 12 is **CUT** from this lane and held for an owner decision on the haiCore half; Task 5 is **built as planned**, with the plan stating that two of its arms are inert against the as-built wire.
- **Q2 (PF P11, PF P12)** — the spec §10.6 three-pack comparison stays, rendered from the protocol's own pack constant with one typed formatter per key and no cast; the current pack column is highlighted from the route's value; the ceiling comes from the route.
- **Q3 (PF P15)** — Tasks 6–8 ship; the BFF maps an upstream 403 on the two inquiry routes to a fixed empty state, pinned by a red; granting the scope to the portal client is an owner deploy item.
- **Q4 (PF P14)** — Batch 0 adds `role="tablist"`, `role="tab"` and `aria-selected` to the shared tabs component, copying `src/components/sonar/section-tabs.tsx`; gate = FULL `npx vitest run` + `npm run build`.
- **Q5 (PF P6)** — the deployed value of `PROTOCOL_STRICT_VALIDATION` is an owner item; the amendment is the same under either value.
- **Q6 (PF P28)** — Task 13's admit arm is tightened here only; `src/app/api/account/__tests__/role-gate-obligations-audit.test.ts` is NOT edited (house item, owner list).

**Owner items this lane does not close** (recorded so nobody re-derives them): the haiCore projection of `trust_class` and `pending_activation_at` on the active-connections list (Task 5); a haiCore admin list route for proposals (Task 12); the `inquiry:ask` grant to the portal Keycloak client (Tasks 6–8); the deployed `PROTOCOL_STRICT_VALIDATION` value (Task 1/2 override path).

---

## Global Constraints

- The lane worktree already exists: `/Users/samfleming/dev/hw/haiWeb-v1101-L7`, branch `v1101-L7-console`, base `61b201fc` (= `origin/master`). Never the primary `~/dev/hw/haiWeb` checkout, and never `~/dev/hw/haiCore` or `~/dev/hw/haiClient`. Use `git -C <abs path>`, never a bare `cd`.
- L1–L4's haiCore routes are **merged**: the as-built tree is `main` at `16b31655`, read-only at `/Users/samfleming/dev/hw/haiCore-v1101-L3`. Every wire shape in this plan was measured there; where this plan and haiCore disagree, haiCore is right and this plan is wrong.
- **Protocol pin — NEVER run `npm install` or `npm ci` in this worktree (PF P26).** `package.json` declares the protocol as a `file:` dependency resolving to the live primary (3.87.0, no `inquiry/` sub-package); the worktree's `node_modules/@haiwave/protocol` has been re-pointed by hand at the 3.88.0 build. An install silently restores the primary and every protocol import in this plan then fails to resolve, which looks like a plan defect and is not. **Every batch gate runs this first:**

```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json   # expect: "version": "3.88.0",
readlink node_modules/@haiwave/protocol                                  # expect: /Users/samfleming/dev/hw/haiCore-v1101-L3/packages/protocol
```

  If either differs, **STOP** and tell the controller; do not repair it and carry on.
- **`npm run build` joins EVERY batch gate**, not only the tasks that widen a shared type — vitest never typechecks, every BFF test mocks the upstream client and every page test mocks `server-fetch`, so the build is this lane's only automated defence against a wire-shape error.
- `vitest.config.ts:24` sets `retry: 2`. **Every task's test step reads the reporter for `(retry x1)`/`(retry x2)` markers — a retried green is NOT a green**; re-run the file alone before believing it.
- No console ask composer (P8 — the spec's own ruling id). The buyer side of an inquiry is the `qualified_inquiry` chat intent on the agent, out of scope here — the console only displays inquiries (Tasks 6–7).
- Vocabulary: every new label uses `TrustClass` via `TRUST_CLASS_LABEL` (`src/app/account/sonar/posture/trust-bypass/_components/trust-class-label.ts:3-8`) — Unknown / Behavioral-only / Trading pair / Premier partner. **Import it; never re-declare it** (PF P23). Never "Public" or "Qualified" as a trust-class label; `LibraryTier`'s existing "Qualified" (`src/lib/library-types.ts:1-5` — the type is at `:1`, the labels at `:3-5`, PF P29) names the library tier model and is untouched.
- Every new `route.ts` exporting POST/PUT/PATCH/DELETE must carry a D-211 gate (`role:`, `requireAdmin`, `hasRole(`, or `forbidNonEditor(`) as literal source text — `src/__tests__/bff-mutations-are-role-gated.test.ts:17-18` greps for it. The pre-flight measured all ten of this plan's mutation routes as passing that ratchet by construction; keep it that way.
- **Commits (PF P32).** Every commit ends with a `Co-Authored-By:` trailer naming **the model that actually authored that commit** — never a name copied from this plan or from a neighbouring commit. Take the message from a file, never `-m`: backticks inside a double-quoted `-m` are command-substituted by the shell and the identifiers vanish silently. Never `--amend`. The message file lives in the git-ignored lane workspace:

```bash
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
<subject line>

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

- `PROTOCOL_STRICT_VALIDATION` (haiCore `apps/core/src/config/env.ts:111`) defaults to `warn`, which **accepts and strips** an unrecognized body key instead of rejecting it. Its deployed value is an **owner item** (Q5); this plan is written so that no request body carries a key its route does not declare, which is correct under either value.
- Any task widening a shared type (`MockPartner`, `safe-room-types.ts`) must run `npm run build` — but so must every other task, per the batch-gate rule above.
- No Playwright additions this release; `e2e/` is untouched.
- Nav badges: the Request Management precedent exists (`account-nav.tsx:259-274`, polling `/api/sonar/compliance/requests/counts`), but no new nav item in this plan gets one — the pending-activation gesture has no haiCore counts route in L2's scope, and the Inquiry Log / Attribute Classes entries have none defined this cycle. A follow-up can add badges once counts routes exist.
- D-146 eligibility: spec §3.3 restricts `activate` to the account_admin on the side that did NOT set the last invite. The console does not compute that eligibility client-side — it shows Accept/Decline to both sides whenever `pending_activation_at` is set and relies on haiCore's 403 (surfaced through `confirmed()`, `partners-panel.tsx:83-97`) to refuse the wrong side. Deliberate scope boundary, not an omission. See **PF P13** in Task 5: at `16b31655` that field is not on the wire, so the branch does not render yet.

---

## File Structure

```
src/components/tabs.tsx                                                 # Task 0 (modify — PF P14)
src/components/__tests__/tabs.test.tsx                                  # Task 0 (new)
src/lib/safe-room-types.ts                                              # Tasks 1, 6, 9, 11
src/lib/forward-haicore-response.ts                                     # Task 1
src/app/api/account/disclosure-policy/route.ts                          # Task 1 (GET + PUT)
src/app/api/account/disclosure-policy/overrides/route.ts                # Task 1 (GET — PF P24)
src/app/api/account/disclosure-policy/overrides/[counterpartyId]/route.ts  # Task 1 (PUT — PF P6)
src/app/api/account/room-participation/route.ts                         # Task 1 (GET + PUT — PF P4)
src/app/api/account/attribute-classes/route.ts                          # Task 1
src/app/account/disclosure-policy/_components/*.tsx                     # Task 2
src/app/account/disclosure-policy/page.tsx                              # Task 2
src/app/api/account/connections/[id]/premier/route.ts                   # Task 3
src/app/api/account/connections/[id]/activate/route.ts                  # Task 4
src/app/api/account/connections/[id]/decline-activation/route.ts        # Task 4
src/app/account/partners/partners-panel.tsx                             # Task 5 (modify)
src/app/api/account/sonar/inquiries/route.ts                            # Task 6
src/app/api/account/sonar/inquiries/[id]/route.ts                       # Task 6
src/app/account/sonar/inquiries/_components/*.tsx                       # Task 7
src/app/account/sonar/inquiries/page.tsx                                # Task 7
src/app/account/sonar/inquiries/[id]/page.tsx                           # Task 8
src/app/api/account/query-guard/pack/route.ts                           # Task 9
src/app/account/settings/query-guard/_components/inquiry-pack-panel.tsx # Task 10
src/app/api/account/attribute-classes/proposals/route.ts                # Task 11
src/app/account/attribute-classes/_components/*.tsx                     # Task 11
src/app/account/attribute-classes/page.tsx                              # Task 11
src/app/api/admin/attribute-classes/proposals/**/route.ts               # Task 12 — CUT, not written this lane
src/app/admin/attribute-classes/page.tsx                                # Task 12 — CUT, not written this lane
src/app/api/account/__tests__/role-gate-safe-room-routes.test.ts        # Task 13
```

Modified: `src/components/tabs.tsx`, `src/lib/mock-types.ts`, `src/app/api/account/partners/route.ts`, `src/app/account/partners/partners-panel.tsx`, `src/components/account-nav.tsx`, `src/app/account/settings/query-guard/page.tsx`. (`src/app/admin/layout.tsx` is **not** modified — it was Task 12's edit.)

---

## Execution order

Batches, in this order. One commit per task; the batch is the gate boundary. **Batch 6 (Task 12) is CUT** and is not dispatched. Serialise: never run two gates in this repo at once.

Every batch gate is three steps, in order:

1. the protocol pin check (Global Constraints, **PF P26**);
2. the batch's `npx vitest run …`, reading the reporter for `(retry x` markers;
3. `npm run build`.

| # | Batch | Tasks | vitest scope (then `npm run build`) |
|---|---|---|---|
| 1st | **Batch 0** — shared tabs ARIA | Task 0 | `npx vitest run` (**FULL** — the component is repo-wide) |
| 2nd | **Batch 4** — configuration packs | Tasks 9, 10 | `npx vitest run src/app/api/account/query-guard src/app/account/settings/query-guard` |
| 3rd | **Batch 1** — disclosure policy | Tasks 1, 2 | `npx vitest run src/app/api/account/disclosure-policy src/app/api/account/room-participation src/app/api/account/attribute-classes src/app/account/disclosure-policy` |
| 4th | **Batch 5** — registry proposals (participant) | Task 11 | `npx vitest run src/app/api/account/attribute-classes src/app/account/attribute-classes` |
| 5th | **Batch 2** — connections | Tasks 3, 4, 5 | `npx vitest run src/app/api/account/connections src/app/api/account/partners src/app/account/partners` |
| 6th | **Batch 3** — inquiry log | Tasks 6, 7, 8 | `npx vitest run src/app/api/account/sonar/inquiries src/app/account/sonar/inquiries` |
| 7th | **Batch 7** — D-211 ratchet | Task 13 | `npx vitest run` (**FULL**) |
| — | **Batch 6** — admin proposal queue | Task 12 | **CUT** — blocked on haiCore (Q1); do not dispatch |

Batch 1's vitest scope is the pre-flight's, plus the one file this amendment adds: `src/lib/__tests__/forward-haicore-response.test.ts` (**PF P27**), which Task 1 creates.

Why this order: Batch 0 must precede Batches 2 and 3, whose tab assertions depend on it. Batch 4 is the only batch with no external dependency and no inert surface, so it goes first among the surfaces and gives the controller an early complete green. Batch 7 observes what every earlier batch built, so it goes last.

**COMBINED gate** after Batch 7 — owed even though the batches touch mostly disjoint files, because `src/components/account-nav.tsx` is edited by Batches 1, 3 and 5 and `src/lib/safe-room-types.ts` by Batches 1, 3, 4 and 5. File overlap is not the test; behaviour overlap is.

```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run
npm run build
npm run lint
```

Then **HOLD**: a whole-branch review, one fix wave, a re-review, then the binding gate on the exact tip, then `push -u` and the PR. **No merge without the owner's word.**

---

## Task 0: ARIA roles on the shared `Tabs` component (PF P14, ruling Q4)

**Files:**
- Modify: `src/components/tabs.tsx`
- Test: `src/components/__tests__/tabs.test.tsx` (new)

**Why this task exists.** Five assertions in Tasks 5 and 7 query `getByRole('tab', …)`. The shared `Tabs` component renders bare `<button>` elements with no ARIA:

```
$ git -C /Users/samfleming/dev/hw/haiWeb-v1101-L7 show HEAD:src/components/tabs.tsx | sed -n '18,21p'
18       {tabs.map((tab) => (
19         <button
20           key={tab.key}
21           onClick={() => onChange(tab.key)}
$ git -C /Users/samfleming/dev/hw/haiWeb-v1101-L7 grep -c 'role="tab"' -- src/components/tabs.tsx
  0 hits
$ git -C /Users/samfleming/dev/hw/haiWeb-v1101-L7 grep -rln 'role="tab"' -- src        # PRESENT CONTROL
src/components/sonar/section-tabs.tsx
```

So those five assertions cannot pass, and the component fails the WCAG 2.1 AA expectation the house already meets in `sonar/section-tabs.tsx`. The controller ruled (Q4) to fix the component rather than downgrade the assertions.

**Scope — exactly three attributes, in one file.** `role="tablist"` on the wrapper `<div>`, and `role="tab"` plus `aria-selected={active === tab.key}` on each `<button>`. **Not** in scope: roving `tabIndex`, arrow-key navigation, `aria-controls`/`aria-labelledby` wiring or `tabpanel` elements — `section-tabs.tsx` owns those because it renders its own panels; `Tabs` consumers render the panel themselves, so there is no panel id to wire. Nothing else in the file changes, and no consumer is edited.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/__tests__/tabs.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tabs } from '../tabs';

const tabs = [{ key: 'inbound', label: 'Inbound' }, { key: 'outbound', label: 'Outbound', count: 3 }];

describe('Tabs', () => {
  it('renders a tablist whose tabs carry role="tab" and aria-selected', () => {
    render(<Tabs tabs={tabs} active="inbound" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /Inbound/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Outbound/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('still calls onChange with the clicked tab key, and still renders the count badge', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} active="inbound" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: /Outbound/ }));
    expect(onChange).toHaveBeenCalledWith('outbound');
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/tabs.test.tsx`
Expected: FAIL — `Unable to find an accessible element with the role "tablist"`. That is the right reason: the module resolves and the component renders, it simply exposes no roles. Read the reporter for `(retry x` markers.

- [ ] **Step 3: Add the three attributes**

```tsx
// src/components/tabs.tsx — inside Tabs(), the wrapper and each button; everything else unchanged
    <div role="tablist" className="flex border-b border-slate/15 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={/* unchanged */}
        >
```

- [ ] **Step 4: Run the FULL suite, then build**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run
npm run build
```
Expected: every suite PASS — the blast radius is every `Tabs` consumer (`partners-panel.tsx`, `orders-dashboard.tsx`, `payments-dashboard.tsx`, `manifests/page.tsx`, `provenance-keys-dashboard.tsx`, `registrations-filters.tsx`, `sonar/requests/direction-tabs.tsx`), so a full run is the gate, not a scoped one. Read the reporter for `(retry x` markers; a retried green is not a green. `npm run build` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/tabs.tsx src/components/__tests__/tabs.test.tsx
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(a11y): tablist/tab roles and aria-selected on the shared Tabs component

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 1: Shared forwarding helper, disclosure-policy routes, room participation, adopted attribute-class list

> **Amended:** PF P3 (read envelope), PF P4 (room-participation GET), PF P5 (per-cell shortfall on the write), PF P6 (override body and uuid param), PF P7 (attribute-class envelope), PF P24 (overrides GET), PF P27 (204 branch), PF P31 (citation).

**Files:**
- Create: `src/lib/forward-haicore-response.ts`, `src/lib/safe-room-types.ts`
- Create: `src/app/api/account/disclosure-policy/route.ts` (GET + PUT)
- Create: `src/app/api/account/disclosure-policy/overrides/route.ts` (GET — **PF P24**)
- Create: `src/app/api/account/disclosure-policy/overrides/[counterpartyId]/route.ts` (PUT — **PF P6**)
- Create: `src/app/api/account/room-participation/route.ts` (GET + PUT — **PF P4**)
- Create: `src/app/api/account/attribute-classes/route.ts` (GET)
- Test: `src/lib/__tests__/forward-haicore-response.test.ts`, plus a matching `__tests__/route.test.ts` beside each of the five routes above

**Interfaces:**
- Produces: `forwardHaiCoreResponse(res: { status: number; text(): Promise<string> }): Promise<NextResponse>`, imported by every later route instead of repeating the parse/passthrough block, **including the 204 branch** (PF P27). Plus the shared types below, measured against the as-built `apps/core/src/routes/disclosure-policy.ts` and `attribute-classes.ts` at `16b31655`.
- Consumes: `withHaiCore` (`src/lib/with-hai-core.ts:84-155`), `client.fetchRaw` (`src/lib/haiwave-api.ts:2389-2394`; the `/api/v1` prefix comes from `haiwaveApiUrl` at `src/lib/haiwave-api.ts:232`, not from the cited range — **PF P31**), `forbidNonEditor` (`src/app/api/account/query-guard/_lib/authz.ts:20-23`).
- Design: none of these are existing `HaiwaveClient` methods, so all routes use `client.fetchRaw` directly, as `src/app/api/sonar/compliance/requests/obligations/[id]/accept/route.ts:16-51` did for its v1.35 endpoint. PUT routes use `forbidNonEditor` (stricter than the `{role:'account_admin'}` ladder) since disclosure policy is query-guard-adjacent. The two GETs carry no role gate — they are reads.
- **Wire shapes (measured, not assumed).** `GET /disclosure-policy` → `{ matrix: Row[] }`, one key, each row carrying `disclose_shortfall_quantity` and `source: 'registry' | 'participant'`. `PUT /disclosure-policy` is **full-replace**: its schema defaults the shortfall flag, so a body that omits it writes `false` — every caller must send the whole cell (**PF P5**). `GET /disclosure-policy/overrides` → `{ overrides: [...] }`. `PUT /disclosure-policy/overrides/:counterpartyId` takes `{ attribute_class_id, disclosure, disclose_shortfall_quantity }` and **no `trust_class`** — the override is keyed on (counterparty × attribute class); `counterpartyId` must be a **uuid** (**PF P6**). `GET /room-participation` → `{ global, per_class }`; the PUT body is unchanged (**PF P4**). `GET /attribute-classes` → `{ attribute_classes }` (**PF P7**).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/forward-haicore-response.test.ts   (PF P27)
import { describe, it, expect } from 'vitest';
import { forwardHaiCoreResponse } from '../forward-haicore-response';

describe('forwardHaiCoreResponse', () => {
  it('returns a bodyless 204 without reading the upstream body', async () => {
    let read = false;
    const res = await forwardHaiCoreResponse({ status: 204, text: async () => { read = true; return ''; } });
    expect(res.status).toBe(204);
    expect(read).toBe(false);
    expect(await res.text()).toBe('');
  });

  it('parses a JSON body and keeps the upstream status', async () => {
    const res = await forwardHaiCoreResponse({ status: 409, text: async () => JSON.stringify({ error: { code: 'NOT_A_TRADING_PAIR' } }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'NOT_A_TRADING_PAIR' } });
  });
});
```

```typescript
// src/app/api/account/disclosure-policy/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, PUT } from '../route';

const BASE = 'http://localhost/api/account/disclosure-policy';
// The whole cell, as the full-replace PUT requires (PF P5).
const CELL = { attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'raw', disclose_shortfall_quantity: true };

describe('/api/account/disclosure-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET forwards to haiCore and returns the { matrix } body verbatim', async () => {
    const payload = { matrix: [{ ...CELL, source: 'participant' }] };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest(BASE), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/disclosure-policy');
    expect(await res.json()).toEqual(payload);
  });

  it('PUT returns 403 for a non-editor role before calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest(BASE, { method: 'PUT', body: JSON.stringify(CELL) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('PUT forwards the WHOLE cell an account_admin sent, shortfall flag included', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ row: { ...CELL, source: 'participant' } }) });
    const res = await PUT(new NextRequest(BASE, { method: 'PUT', body: JSON.stringify(CELL) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/disclosure-policy', expect.objectContaining({ method: 'PUT', body: JSON.stringify(CELL) }));
    expect(JSON.parse(fetchRaw.mock.calls[0][1].body as string)).toHaveProperty('disclose_shortfall_quantity');
    expect(res.status).toBe(200);
  });
});
```

```typescript
// src/app/api/account/disclosure-policy/overrides/__tests__/route.test.ts   (PF P24)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/disclosure-policy/overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('is readable by any session role and returns the { overrides } envelope verbatim', async () => {
    const payload = { overrides: [{ counterparty_participant_id: '11111111-1111-4111-8111-111111111111', attribute_class_id: 'availability', disclosure: 'qualified', disclose_shortfall_quantity: null }] };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/disclosure-policy/overrides');
    expect(await res.json()).toEqual(payload);
  });
});
```

```typescript
// src/app/api/account/disclosure-policy/overrides/[counterpartyId]/__tests__/route.test.ts   (PF P6)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { PUT } from '../route';

// haiCore parses this param with z.string().uuid() — a short id is a 400 upstream.
const COUNTERPARTY = '11111111-1111-4111-8111-111111111111';
const OVERRIDE = { attribute_class_id: 'availability', disclosure: 'qualified', disclose_shortfall_quantity: null };

describe('PUT /api/account/disclosure-policy/overrides/[counterpartyId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 403 for a non-editor role before calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(OVERRIDE) }), { params: Promise.resolve({ counterpartyId: COUNTERPARTY }) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards the override to the counterparty path, and the body carries no trust_class', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ override: { counterparty_participant_id: COUNTERPARTY, ...OVERRIDE } }) });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(OVERRIDE) }), { params: Promise.resolve({ counterpartyId: COUNTERPARTY }) });
    expect(fetchRaw).toHaveBeenCalledWith(`/disclosure-policy/overrides/${COUNTERPARTY}`, expect.objectContaining({ method: 'PUT' }));
    expect(JSON.parse(fetchRaw.mock.calls[0][1].body as string)).not.toHaveProperty('trust_class');
    expect(res.status).toBe(200);
  });
});
```

```typescript
// src/app/api/account/room-participation/__tests__/route.test.ts   (PF P4)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, PUT } from '../route';

describe('/api/account/room-participation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET returns the { global, per_class } state verbatim', async () => {
    const payload = { global: true, per_class: { availability: false } };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/room-participation');
    expect(await res.json()).toEqual(payload);
  });

  it('PUT returns 403 for a non-editor role', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ attribute_class_id: null, enabled: false }) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards a global opt-out (attribute_class_id: null) verbatim', async () => {
    const body = { attribute_class_id: null, enabled: false };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(body) });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/room-participation', expect.objectContaining({ method: 'PUT', body: JSON.stringify(body) }));
    expect(res.status).toBe(200);
  });
});
```

```typescript
// src/app/api/account/attribute-classes/__tests__/route.test.ts   (PF P7)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/attribute-classes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('is readable by any session role and returns the { attribute_classes } envelope verbatim', async () => {
    const payload = { attribute_classes: [{ attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted' }] };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/attribute-classes');
    expect(await res.json()).toEqual(payload);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/forward-haicore-response.test.ts src/app/api/account/disclosure-policy src/app/api/account/room-participation src/app/api/account/attribute-classes`
Expected: FAIL — `Cannot find module '../route'` for all five route suites and `Cannot find module '../forward-haicore-response'` for the helper suite. That is the right reason: nothing exists yet.

- [ ] **Step 3: Write the helper, types, and five route implementations**

```typescript
// src/lib/forward-haicore-response.ts
import { NextResponse } from 'next/server';

/**
 * Parses a client.fetchRaw() body and returns it as a NextResponse with the same status —
 * the SF-3 idiom of src/app/api/sonar/compliance/requests/obligations/[id]/accept/route.ts:46-50,
 * shared so every v1.101 route doesn't repeat it. The 204 branch (`:46`) is part of the idiom
 * (PF P27): a 204 may carry no body at all, and undici rejects a 204 that does.
 */
export async function forwardHaiCoreResponse(res: { status: number; text(): Promise<string> }): Promise<NextResponse> {
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return NextResponse.json(parsed, { status: res.status });
}
```

```typescript
// src/lib/safe-room-types.ts
import type { AttributeClass, TrustClass } from '@haiwave/protocol';

// ─── Disclosure policy (spec §5; as-built apps/core/src/routes/disclosure-policy.ts at 16b31655) ───
export type Disclosure = 'raw' | 'qualified' | 'declined';

/** One matrix cell: (attribute class × trust class). PF P3, PF P5. */
export interface DisclosurePolicyRow {
  attribute_class_id: string;
  trust_class: TrustClass;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean;
  source: 'registry' | 'participant';
}

/** GET /disclosure-policy — one key (PF P3). */
export interface DisclosurePolicyResponse {
  matrix: DisclosurePolicyRow[];
}

/** One per-counterparty override — keyed (counterparty × attribute class), never on a trust class (PF P6). */
export interface DisclosurePolicyOverrideRow {
  counterparty_participant_id: string;
  attribute_class_id: string;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean | null;
}

/** GET /disclosure-policy/overrides (PF P24). */
export interface DisclosurePolicyOverridesResponse {
  overrides: DisclosurePolicyOverrideRow[];
}

/** GET /room-participation — an object, not an array (PF P4). */
export interface RoomParticipationState {
  global: boolean;
  per_class: Record<string, boolean>;
}

/** PUT /room-participation body — the element shape the write still takes (measured MATCH). */
export interface RoomParticipationSetting {
  attribute_class_id: string | null; // null = the global setting
  enabled: boolean;
}

// ─── Attribute-class registry (spec §4.1–4.3) ───
/**
 * Read-only display subset of the protocol's own `AttributeClass` (PF P7), derived with `Pick`
 * so a protocol change is a build error rather than a silent drift. NEVER use it for a write:
 * a proposal body must satisfy `AttributeClassProposalSchema` in full — see Task 11 (PF P8).
 */
export type AttributeClassSummary = Pick<AttributeClass, 'attribute_class_id' | 'display_name' | 'status' | 'default_disclosure'>;

/** GET /attribute-classes (PF P7). */
export interface AttributeClassListResponse {
  attribute_classes: AttributeClassSummary[];
}
```

```typescript
// src/app/api/account/disclosure-policy/route.ts
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../query-guard/_lib/authz';

/** GET → { matrix }. PUT is FULL-REPLACE: the caller sends the whole cell (PF P5). */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/disclosure-policy')));

export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw('/disclosure-policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
```

```typescript
// src/app/api/account/disclosure-policy/overrides/route.ts   (PF P24)
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** GET /api/account/disclosure-policy/overrides — a read, so no role gate. Consumed by Task 2's ?counterparty= view. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/disclosure-policy/overrides')));
```

```typescript
// src/app/api/account/disclosure-policy/overrides/[counterpartyId]/route.ts   (PF P6)
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../../../query-guard/_lib/authz';

/**
 * PUT /api/account/disclosure-policy/overrides/:counterpartyId — spec §5.1, reached from Task 2's page.
 * The override is keyed (counterparty × attribute class): the body is
 * { attribute_class_id, disclosure, disclose_shortfall_quantity } and carries NO trust_class.
 * `counterpartyId` is a participant uuid upstream; the page passes the partner row's id.
 */
export const PUT = withHaiCore<{ counterpartyId: string }>(async ({ client, request, session, params }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw(`/disclosure-policy/overrides/${encodeURIComponent(params.counterpartyId)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
```

```typescript
// src/app/api/account/room-participation/route.ts   (PF P4)
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../query-guard/_lib/authz';

/** GET → { global, per_class }. PUT takes one setting: { attribute_class_id: string | null, enabled }. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/room-participation')));

export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw('/room-participation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
```

```typescript
// src/app/api/account/attribute-classes/route.ts
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** Read-only reference data (the upstream serves adopted classes only) — no role gate. Consumed by Tasks 2 and 11. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/attribute-classes')));
```

- [ ] **Step 4: Run the tests to verify they pass, then build**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run src/lib/__tests__/forward-haicore-response.test.ts src/app/api/account/disclosure-policy src/app/api/account/room-participation src/app/api/account/attribute-classes
npm run build
```
Expected: PASS, 12 tests. Read the reporter for `(retry x1)`/`(retry x2)` markers — a retried green is not a green. `npm run build` exits 0; this task is where `safe-room-types.ts` is born, so the build is the only thing that checks it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forward-haicore-response.ts src/lib/safe-room-types.ts src/lib/__tests__/forward-haicore-response.test.ts src/app/api/account/disclosure-policy src/app/api/account/room-participation src/app/api/account/attribute-classes
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(bff): disclosure-policy, overrides, room-participation and attribute-classes routes

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 2: Disclosure-policy components, page, nav entry, partners-panel link

> **Amended:** PF P3 (read envelope + source union), PF P4 (participation is an object, fetched separately), PF P5 (the shortfall flag moves into the matrix, per cell, and every save sends the whole cell), PF P6 (the counterparty override is its own control and sends no trust class), PF P7 (attribute-class envelope), PF P23 (import the trust-class labels), PF P24 (read the overrides).

**Files:**
- Create: `src/app/account/disclosure-policy/_components/disclosure-policy-matrix.tsx`
- Create: `src/app/account/disclosure-policy/_components/room-participation-panel.tsx`
- Create: `src/app/account/disclosure-policy/_components/counterparty-overrides-panel.tsx` (**PF P6**, **PF P24**)
- Create: `src/app/account/disclosure-policy/_components/disclosure-policy-client.tsx`
- Create: `src/app/account/disclosure-policy/page.tsx`
- Modify: `src/components/account-nav.tsx:161-186`, `src/app/account/partners/partners-panel.tsx:407-438`
- Test: `src/app/account/disclosure-policy/_components/__tests__/disclosure-policy-matrix.test.tsx` (also covers `RoomParticipationPanel`)
- Test: `src/app/account/disclosure-policy/_components/__tests__/counterparty-overrides-panel.test.tsx`
- Test: `src/app/account/disclosure-policy/_components/__tests__/disclosure-policy-client.test.tsx`

**Interfaces:**
- Consumes: `DisclosurePolicyRow` / `DisclosurePolicyResponse` / `DisclosurePolicyOverrideRow` / `DisclosurePolicyOverridesResponse` / `RoomParticipationState` / `AttributeClassSummary` / `AttributeClassListResponse` / `Disclosure` (Task 1), `fetchBffJson`, `PageHeader` (`src/components`), and `TRUST_CLASS_LABEL` imported from `src/app/account/sonar/posture/trust-bypass/_components/trust-class-label.ts:3-8` — **never re-declared locally** (**PF P23**).
- Design: `page.tsx` is a server component (data fetch only); `disclosure-policy-client.tsx` is `'use client'` and owns state plus the PUT calls, receiving the server's reads — the split `GuardRulesMatrix` uses (`guard-rules-matrix.tsx:86-90`). The matrix copies `GuardRulesMatrix`'s grid shape (`:197-256`).
- **The matrix cell is the write unit (PF P5).** `PUT /disclosure-policy` is full-replace and defaults the shortfall flag, so a body of three fields silently clears it. Both controls in a cell — the disclosure `<select>` and the shortfall checkbox — therefore call `onSave` with the **whole** resolved cell. The cell is composed in the matrix, which already holds the resolved row, so the client keeps a single `saveCell` and there is exactly one place in the lane that can send a partial body.
- **The per-counterparty override is a different control, not the same matrix (PF P6).** Its key is (counterparty × attribute class) with no trust class, so the `?counterparty=` view renders one row per attribute class — a disclosure select and a nullable shortfall select — and PUTs `{ attribute_class_id, disclosure, disclose_shortfall_quantity }`. Sending a trust class there would be accepted and stripped under the default strict-validation mode and the override would then apply to **all four** trust classes, which is a disclosure widening nobody asked for.
- **Inherited vs overridden (PF P24).** The page reads `GET /disclosure-policy/overrides` when `?counterparty=` is set and filters to that counterparty, so a cell shows whether the value is the participant default or a real override. At `16b31655` there is **no override-removal route**, so the control adds and changes overrides only; the page says so in one line rather than offering a Remove the wire cannot serve.
- **Why not `TristateCheckbox`** (`src/components/tristate-checkbox.tsx`): its `'partial'` is a derived visual state the user cannot select, and the override's third state (inherit) must be selectable. A three-option `<select>` is used instead.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/account/disclosure-policy/_components/__tests__/disclosure-policy-matrix.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DisclosurePolicyMatrix } from '../disclosure-policy-matrix';
import { RoomParticipationPanel } from '../room-participation-panel';
import type { AttributeClassSummary, DisclosurePolicyRow } from '@/lib/safe-room-types';

const classes: AttributeClassSummary[] = [{
  attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted',
  default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' },
}];

describe('DisclosurePolicyMatrix', () => {
  it('shows the registry default when no participant row exists', () => {
    render(<DisclosurePolicyMatrix classes={classes} rows={[]} onSave={vi.fn()} />);
    expect(screen.getByLabelText('availability disclosure for trading_pair')).toHaveValue('qualified');
  });

  it('prefers a participant row over the registry default', () => {
    const rows: DisclosurePolicyRow[] = [{ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'raw', disclose_shortfall_quantity: false, source: 'participant' }];
    render(<DisclosurePolicyMatrix classes={classes} rows={rows} onSave={vi.fn()} />);
    expect(screen.getByLabelText('availability disclosure for trading_pair')).toHaveValue('raw');
  });

  // PF P5 — the write is full-replace, so a disclosure change must carry the flag the cell already had.
  it('changing a cell disclosure preserves its disclose_shortfall_quantity', () => {
    const onSave = vi.fn();
    const rows: DisclosurePolicyRow[] = [{ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'qualified', disclose_shortfall_quantity: true, source: 'participant' }];
    render(<DisclosurePolicyMatrix classes={classes} rows={rows} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    expect(onSave).toHaveBeenCalledWith({ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'raw', disclose_shortfall_quantity: true });
  });

  it('toggling the per-cell shortfall flag sends the whole cell, disclosure included', () => {
    const onSave = vi.fn();
    render(<DisclosurePolicyMatrix classes={classes} rows={[]} onSave={onSave} />);
    fireEvent.click(screen.getByLabelText('availability disclose shortfall quantity for trading_pair'));
    expect(onSave).toHaveBeenCalledWith({ attribute_class_id: 'availability', trust_class: 'trading_pair', disclosure: 'qualified', disclose_shortfall_quantity: true });
  });
});

describe('RoomParticipationPanel', () => {
  it('reads the global switch from the participation state', () => {
    const onToggleParticipation = vi.fn();
    render(<RoomParticipationPanel classes={classes} participation={{ global: true, per_class: {} }} onToggleParticipation={onToggleParticipation} />);
    fireEvent.click(screen.getByLabelText('Participate in the evaluation room (all classes)'));
    expect(onToggleParticipation).toHaveBeenCalledWith(null, false);
  });

  it('falls back to the global value for a class absent from per_class', () => {
    render(<RoomParticipationPanel classes={classes} participation={{ global: false, per_class: {} }} onToggleParticipation={vi.fn()} />);
    expect(screen.getByLabelText('Participate in the evaluation room for Availability')).not.toBeChecked();
  });
});
```

```tsx
// src/app/account/disclosure-policy/_components/__tests__/counterparty-overrides-panel.test.tsx   (PF P6, PF P24)
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CounterpartyOverridesPanel } from '../counterparty-overrides-panel';
import type { AttributeClassSummary, DisclosurePolicyOverrideRow } from '@/lib/safe-room-types';

const COUNTERPARTY = '11111111-1111-4111-8111-111111111111';
const classes: AttributeClassSummary[] = [{
  attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted',
  default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' },
}];

describe('CounterpartyOverridesPanel', () => {
  it('marks a class inherited with no override row, and overridden with one', () => {
    const { rerender } = render(<CounterpartyOverridesPanel classes={classes} overrides={[]} onSaveOverride={vi.fn()} />);
    expect(screen.getByText('Inherited')).toBeInTheDocument();
    const overrides: DisclosurePolicyOverrideRow[] = [{ counterparty_participant_id: COUNTERPARTY, attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: null }];
    rerender(<CounterpartyOverridesPanel classes={classes} overrides={overrides} onSaveOverride={vi.fn()} />);
    expect(screen.getByText('Override')).toBeInTheDocument();
    expect(screen.queryByText('Inherited')).not.toBeInTheDocument();
  });

  it('saves an override with no trust_class key', () => {
    const onSaveOverride = vi.fn();
    render(<CounterpartyOverridesPanel classes={classes} overrides={[]} onSaveOverride={onSaveOverride} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    expect(onSaveOverride).toHaveBeenCalledWith({ attribute_class_id: 'availability', disclosure: 'declined', disclose_shortfall_quantity: null });
    expect(onSaveOverride.mock.calls[0][0]).not.toHaveProperty('trust_class');
  });
});
```

```tsx
// src/app/account/disclosure-policy/_components/__tests__/disclosure-policy-client.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DisclosurePolicyClient } from '../disclosure-policy-client';
import type { AttributeClassSummary, DisclosurePolicyResponse } from '@/lib/safe-room-types';

const COUNTERPARTY = '11111111-1111-4111-8111-111111111111';
const classes: AttributeClassSummary[] = [{ attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted', default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' } }];
const policy: DisclosurePolicyResponse = { matrix: [] };

describe('DisclosurePolicyClient', () => {
  it('PUTs the whole cell to the main route when no counterparty is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={null} />);
    fireEvent.change(screen.getByLabelText('availability disclosure for trading_pair'), { target: { value: 'raw' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/disclosure-policy', expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).toHaveProperty('disclose_shortfall_quantity');
  });

  it('PUTs to the counterparty override route, and that body carries no trust_class', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    render(<DisclosurePolicyClient classes={classes} policy={policy} participation={{ global: true, per_class: {} }} overrides={[]} counterparty={COUNTERPARTY} />);
    fireEvent.change(screen.getByLabelText('availability override disclosure'), { target: { value: 'declined' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(`/api/account/disclosure-policy/overrides/${COUNTERPARTY}`, expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('trust_class');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/account/disclosure-policy`
Expected: FAIL — none of the components exist yet.

- [ ] **Step 3: Write the components, client wrapper, page, nav entry, partners-panel link**

```tsx
// src/app/account/disclosure-policy/_components/disclosure-policy-matrix.tsx
'use client';

import type { TrustClass } from '@haiwave/protocol';
import { TRUST_CLASS_LABEL } from '@/app/account/sonar/posture/trust-bypass/_components/trust-class-label';
import type { AttributeClassSummary, Disclosure, DisclosurePolicyRow } from '@/lib/safe-room-types';

const TRUST_CLASSES = ['unknown', 'behavioral_only', 'trading_pair', 'premier_partner'] as const;
const DISCLOSURE_LABEL: Record<Disclosure, string> = { raw: 'Raw value', qualified: 'Qualified verdict', declined: 'Declined' };

/** The whole cell — what the full-replace PUT requires (PF P5). */
export interface PolicyCell {
  attribute_class_id: string;
  trust_class: TrustClass;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean;
}

interface Props {
  classes: AttributeClassSummary[];
  rows: DisclosurePolicyRow[];
  onSave: (cell: PolicyCell) => void;
}

function resolveCell(c: AttributeClassSummary, rows: DisclosurePolicyRow[], tc: TrustClass): PolicyCell {
  const row = rows.find((r) => r.attribute_class_id === c.attribute_class_id && r.trust_class === tc);
  return row
    ? { attribute_class_id: c.attribute_class_id, trust_class: tc, disclosure: row.disclosure, disclose_shortfall_quantity: row.disclose_shortfall_quantity }
    : { attribute_class_id: c.attribute_class_id, trust_class: tc, disclosure: c.default_disclosure[tc], disclose_shortfall_quantity: false };
}

export function DisclosurePolicyMatrix({ classes, rows, onSave }: Props) {
  return (
    <div role="grid" className="grid grid-cols-5 gap-px bg-slate/15 border border-slate/15 rounded-md overflow-hidden">
      <div className="bg-light-gray p-3 text-xs font-semibold text-charcoal">Attribute class / Trust class</div>
      {TRUST_CLASSES.map((tc) => <div key={tc} className="bg-light-gray p-3 text-xs font-semibold text-charcoal">{TRUST_CLASS_LABEL[tc]}</div>)}
      {classes.map((c) => (
        <MatrixRow key={c.attribute_class_id} attributeClass={c} rows={rows} onSave={onSave} />
      ))}
    </div>
  );
}

function MatrixRow({ attributeClass, rows, onSave }: { attributeClass: AttributeClassSummary; rows: DisclosurePolicyRow[]; onSave: Props['onSave'] }) {
  return (
    <>
      <div className="bg-white p-3 text-sm font-medium text-charcoal">{attributeClass.display_name}</div>
      {TRUST_CLASSES.map((tc) => {
        const cell = resolveCell(attributeClass, rows, tc);
        return (
          <div key={tc} className="bg-white p-3 space-y-2">
            <select
              aria-label={`${attributeClass.attribute_class_id} disclosure for ${tc}`}
              value={cell.disclosure}
              onChange={(e) => onSave({ ...cell, disclosure: e.target.value as Disclosure })}
              className="w-full text-sm border border-slate/20 rounded px-2 py-1"
            >
              {(['raw', 'qualified', 'declined'] as const).map((dv) => <option key={dv} value={dv}>{DISCLOSURE_LABEL[dv]}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-slate">
              <input
                type="checkbox"
                aria-label={`${attributeClass.attribute_class_id} disclose shortfall quantity for ${tc}`}
                checked={cell.disclose_shortfall_quantity}
                onChange={(e) => onSave({ ...cell, disclose_shortfall_quantity: e.target.checked })}
              />
              Disclose shortfall
            </label>
          </div>
        );
      })}
    </>
  );
}
```

```tsx
// src/app/account/disclosure-policy/_components/room-participation-panel.tsx   (PF P4)
'use client';

import type { AttributeClassSummary, RoomParticipationState } from '@/lib/safe-room-types';

interface Props {
  classes: AttributeClassSummary[];
  participation: RoomParticipationState;
  onToggleParticipation: (attributeClassId: string | null, enabled: boolean) => void;
}

export function RoomParticipationPanel({ classes, participation, onToggleParticipation }: Props) {
  const globalEnabled = participation.global;

  return (
    <div className="mt-8 space-y-4">
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input type="checkbox" aria-label="Participate in the evaluation room (all classes)" checked={globalEnabled} onChange={(e) => onToggleParticipation(null, e.target.checked)} />
        Participate in the evaluation room (all classes)
      </label>
      <ul className="space-y-2">
        {classes.map((c) => {
          const enabled = participation.per_class[c.attribute_class_id] ?? globalEnabled;
          return (
            <li key={c.attribute_class_id} className="flex items-center gap-6 text-sm text-charcoal">
              <label className="flex items-center gap-2">
                <input type="checkbox" aria-label={`Participate in the evaluation room for ${c.display_name}`} checked={enabled} onChange={(e) => onToggleParticipation(c.attribute_class_id, e.target.checked)} />
                {c.display_name}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

```tsx
// src/app/account/disclosure-policy/_components/counterparty-overrides-panel.tsx   (PF P6, PF P24)
'use client';

import type { AttributeClassSummary, Disclosure, DisclosurePolicyOverrideRow } from '@/lib/safe-room-types';

/** The override body — keyed (counterparty × attribute class). No trust class: the wire has none. */
export interface OverrideWrite {
  attribute_class_id: string;
  disclosure: Disclosure;
  disclose_shortfall_quantity: boolean | null;
}

interface Props {
  classes: AttributeClassSummary[];
  overrides: DisclosurePolicyOverrideRow[];
  onSaveOverride: (row: OverrideWrite) => void;
}

export function CounterpartyOverridesPanel({ classes, overrides, onSaveOverride }: Props) {
  return (
    <table className="w-full text-sm border border-slate/15 rounded-md overflow-hidden">
      <thead><tr className="bg-light-gray text-charcoal text-xs font-semibold"><th className="p-2 text-left">Attribute class</th><th className="p-2 text-left">Source</th><th className="p-2 text-left">Disclosure</th><th className="p-2 text-left">Shortfall quantity</th></tr></thead>
      <tbody>
        {classes.map((c) => {
          const current = overrides.find((o) => o.attribute_class_id === c.attribute_class_id) ?? null;
          return (
            <tr key={c.attribute_class_id} className="border-t border-slate/10">
              <td className="p-2 text-charcoal">{c.display_name}</td>
              <td className="p-2 text-slate">{current ? 'Override' : 'Inherited'}</td>
              <td className="p-2">
                <select
                  aria-label={`${c.attribute_class_id} override disclosure`}
                  value={current?.disclosure ?? ''}
                  onChange={(e) => onSaveOverride({ attribute_class_id: c.attribute_class_id, disclosure: e.target.value as Disclosure, disclose_shortfall_quantity: current?.disclose_shortfall_quantity ?? null })}
                  className="w-full text-sm border border-slate/20 rounded px-2 py-1"
                >
                  <option value="" disabled>— inherited —</option>
                  {(['raw', 'qualified', 'declined'] as const).map((dv) => <option key={dv} value={dv}>{dv}</option>)}
                </select>
              </td>
              <td className="p-2">
                <select
                  aria-label={`${c.attribute_class_id} override shortfall quantity`}
                  value={current?.disclose_shortfall_quantity === null || current === null ? 'inherit' : String(current.disclose_shortfall_quantity)}
                  onChange={(e) => onSaveOverride({
                    attribute_class_id: c.attribute_class_id,
                    disclosure: (current?.disclosure ?? c.default_disclosure.trading_pair) as Disclosure,
                    disclose_shortfall_quantity: e.target.value === 'inherit' ? null : e.target.value === 'true',
                  })}
                  className="w-full text-sm border border-slate/20 rounded px-2 py-1"
                >
                  <option value="inherit">Inherit</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

```tsx
// src/app/account/disclosure-policy/_components/disclosure-policy-client.tsx
'use client';

import { useState } from 'react';
import { DisclosurePolicyMatrix, type PolicyCell } from './disclosure-policy-matrix';
import { RoomParticipationPanel } from './room-participation-panel';
import { CounterpartyOverridesPanel, type OverrideWrite } from './counterparty-overrides-panel';
import type { AttributeClassSummary, DisclosurePolicyOverrideRow, DisclosurePolicyResponse, RoomParticipationState } from '@/lib/safe-room-types';

interface Props {
  classes: AttributeClassSummary[];
  policy: DisclosurePolicyResponse;
  participation: RoomParticipationState;
  overrides: DisclosurePolicyOverrideRow[];
  counterparty: string | null;
}

export function DisclosurePolicyClient({ classes, policy, participation, overrides, counterparty }: Props) {
  const [matrix, setMatrix] = useState(policy.matrix);
  const [state, setState] = useState(participation);
  const [overrideRows, setOverrideRows] = useState(overrides);

  /** The ONLY writer of the participant matrix: it always sends a whole cell (PF P5). */
  async function saveCell(cell: PolicyCell) {
    await fetch('/api/account/disclosure-policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cell) });
    setMatrix((prev) => [...prev.filter((r) => !(r.attribute_class_id === cell.attribute_class_id && r.trust_class === cell.trust_class)), { ...cell, source: 'participant' }]);
  }

  /** The ONLY writer of an override: keyed (counterparty × class), never carrying a trust class (PF P6). */
  async function saveOverride(row: OverrideWrite) {
    if (!counterparty) return;
    await fetch(`/api/account/disclosure-policy/overrides/${encodeURIComponent(counterparty)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) });
    setOverrideRows((prev) => [...prev.filter((o) => o.attribute_class_id !== row.attribute_class_id), { counterparty_participant_id: counterparty, ...row }]);
  }

  async function toggleParticipation(attributeClassId: string | null, enabled: boolean) {
    await fetch('/api/account/room-participation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attribute_class_id: attributeClassId, enabled }) });
    setState((prev) => attributeClassId === null
      ? { ...prev, global: enabled }
      : { ...prev, per_class: { ...prev.per_class, [attributeClassId]: enabled } });
  }

  if (counterparty) {
    return (
      <>
        <section aria-labelledby="override-heading" className="mb-6 space-y-2">
          <h2 id="override-heading" className="text-lg font-semibold text-charcoal">Override for counterparty {counterparty}</h2>
          <p className="text-xs text-slate">These overrides apply to this counterparty only, above your participant defaults, and are not per trust class. An override can be added or changed here; removing one is not yet supported.</p>
        </section>
        <CounterpartyOverridesPanel classes={classes} overrides={overrideRows} onSaveOverride={saveOverride} />
      </>
    );
  }

  return (
    <>
      <DisclosurePolicyMatrix classes={classes} rows={matrix} onSave={saveCell} />
      <RoomParticipationPanel classes={classes} participation={state} onToggleParticipation={toggleParticipation} />
    </>
  );
}
```

```tsx
// src/app/account/disclosure-policy/page.tsx
import { fetchBffJson } from '@/lib/server-fetch';
import { PageHeader } from '@/components';
import { DisclosurePolicyClient } from './_components/disclosure-policy-client';
import type { AttributeClassListResponse, DisclosurePolicyOverridesResponse, DisclosurePolicyResponse, RoomParticipationState } from '@/lib/safe-room-types';

export default async function DisclosurePolicyPage({ searchParams }: { searchParams: Promise<{ counterparty?: string }> }) {
  const { counterparty } = await searchParams;
  const [classesRes, policyRes, participationRes] = await Promise.all([
    fetchBffJson<AttributeClassListResponse>('/api/account/attribute-classes'),
    fetchBffJson<DisclosurePolicyResponse>('/api/account/disclosure-policy'),
    fetchBffJson<RoomParticipationState>('/api/account/room-participation'),
  ]);
  // Read only when a counterparty view was asked for (PF P24); the route serves every override
  // this participant has set, so filter to the one counterparty on screen.
  const overridesRes = counterparty
    ? await fetchBffJson<DisclosurePolicyOverridesResponse>('/api/account/disclosure-policy/overrides')
    : null;

  const classes = classesRes.kind === 'ok' ? classesRes.data.attribute_classes.filter((c) => c.status === 'adopted') : [];
  const policy: DisclosurePolicyResponse = policyRes.kind === 'ok' ? policyRes.data : { matrix: [] };
  const participation: RoomParticipationState = participationRes.kind === 'ok' ? participationRes.data : { global: true, per_class: {} };
  const overrides = overridesRes?.kind === 'ok' ? overridesRes.data.overrides.filter((o) => o.counterparty_participant_id === counterparty) : [];
  const error = [classesRes, policyRes, participationRes, overridesRes].find((r) => r?.kind === 'error');

  return (
    <div className="space-y-8">
      <PageHeader title="Disclosure Policy" description="How your agent answers qualified inquiries — the value, a verdict, or nothing — by attribute class and trust class." />
      {error && error.kind === 'error' && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{error.message}</div>}
      <DisclosurePolicyClient classes={classes} policy={policy} participation={participation} overrides={overrides} counterparty={counterparty ?? null} />
    </div>
  );
}
```

```tsx
// src/components/account-nav.tsx — Account Management's items array (:161-186), after "Query Guard"
{ href: "/account/disclosure-policy", label: "Disclosure Policy", tooltip: "How your agent answers qualified inquiries by attribute class and trust class." },
```

```tsx
// src/app/account/partners/partners-panel.tsx — partnerColumns' actions render() (:407-438), after the Trading Pair button.
// p.id is the partner's participant uuid (the shape MOCK_PARTNERS shows at mock-data.ts:155); the
// override route's param is parsed as a uuid upstream, so this is the id that must be passed (PF P6).
<Link href={`/account/disclosure-policy?counterparty=${encodeURIComponent(p.id)}`} className="text-xs text-teal hover:text-navy font-medium">
  Disclosure Policy
</Link>
```

- [ ] **Step 4: Run the tests to verify they pass, then build**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run src/app/account/disclosure-policy
npm run build
```
Expected: vitest PASS, 10 tests; read the reporter for `(retry x` markers. `npm run build` exits 0 — it is the only check that the components agree with `safe-room-types.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/disclosure-policy src/components/account-nav.tsx src/app/account/partners/partners-panel.tsx
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(disclosure-policy): matrix with per-cell shortfall, room participation, counterparty overrides, page and nav item

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 3: Premier designation BFF route

> **Amended:** gate and commit form only. The pre-flight measured this route as MATCH: the as-built `PUT /connections/:id/premier` takes `{ premier: boolean }` and answers with a **superset** of what this task assumes (`connection_id`, `counterparty_participant_id`, `trust_class`, `changed`), so the passthrough is right as written. This task's auth mock was already the real ladder — Tasks 4 and 11 copy it (**PF P2**).

**Files:**
- Create: `src/app/api/account/connections/[id]/premier/route.ts`
- Test: `src/app/api/account/connections/[id]/premier/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `withHaiCore`, `forwardHaiCoreResponse`. Wire body: `{ premier: boolean }` (mirrors `{ invite: boolean }` at `connections/[id]/invite/route.ts:11-23`).
- Produces: `PUT /api/account/connections/:id/premier` for Task 5's UI.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/account/connections/[id]/premier/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { PUT } from '../route';

describe('PUT /api/account/connections/[id]/premier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 403 for a non-account_admin role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ premier: true }) }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards { premier: true } to haiCore and returns the upstream body and status, including a 409 NOT_A_TRADING_PAIR verbatim', async () => {
    const okPayload = { connection_id: 'conn-1', trust_class: 'premier_partner' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(okPayload) });
    const okRes = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ premier: true }) }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(fetchRaw).toHaveBeenCalledWith('/connections/conn-1/premier', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ premier: true }) }));
    expect(okRes.status).toBe(200);

    const conflictBody = { error: { code: 'NOT_A_TRADING_PAIR' } };
    fetchRaw.mockResolvedValueOnce({ status: 409, text: async () => JSON.stringify(conflictBody) });
    const conflictRes = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ premier: true }) }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(conflictRes.status).toBe(409);
    expect(await conflictRes.json()).toEqual(conflictBody);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/account/connections/[id]/premier`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/account/connections/[id]/premier/route.ts
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** PUT /api/account/connections/:id/premier — spec §3.2 (D). Body: { premier: boolean }. */
export const PUT = withHaiCore<{ id: string }>(
  async ({ client, request, params }) => {
    const body = await request.text();
    return forwardHaiCoreResponse(await client.fetchRaw(`/connections/${encodeURIComponent(params.id)}/premier`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
  },
  { role: 'account_admin' },
);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/api/account/connections/[id]/premier`
Expected: PASS, 2 tests. Read the reporter for `(retry x1)`/`(retry x2)` markers — a retried green is not a green. The pin check and `npm run build` run at the Batch 2 gate (`## Execution order`).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/connections/\[id\]/premier
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(bff): premier-designation route

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 4: Trading-pair activation BFF routes (D-146)

> **Amended:** PF P2 (the auth mock in both test files now uses the real role ladder — with `hasRole` forced true the routes' only gate is disabled, the handler runs on an unprimed mock and returns 500, so **both** assertions in the 403 arm fail and the arm can never pass for the right reason), PF P22 (the decline-activation fixture takes the as-built response shape).

**Files:**
- Create: `src/app/api/account/connections/[id]/activate/route.ts`
- Create: `src/app/api/account/connections/[id]/decline-activation/route.ts`
- Test: matching `__tests__/route.test.ts` beside each

**Interfaces:**
- Consumes: `withHaiCore`, `forwardHaiCoreResponse`. Modeled on `obligations/[id]/accept/route.ts:16-51` and its `decline` sibling; no request body for either call.
- Design: see Global Constraints' D-146 eligibility note — this BFF forwards and does not compute eligibility.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/account/connections/[id]/activate/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { POST } from '../route';

describe('POST /api/account/connections/[id]/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 403 for a non-account_admin role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await POST(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('forwards to haiCore and returns 200 with the activated connection', async () => {
    const payload = { connection_id: 'conn-1', relationship_state: 'trading_pair' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await POST(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(fetchRaw).toHaveBeenCalledWith('/connections/conn-1/activate', expect.objectContaining({ method: 'POST' }));
    expect(res.status).toBe(200);
  });
});
```

```typescript
// src/app/api/account/connections/[id]/decline-activation/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { POST } from '../route';

describe('POST /api/account/connections/[id]/decline-activation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('returns 403 for a non-account_admin role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await POST(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  // PF P22: the as-built ActivationDeclineResult is { connection_id, relationship_state, invite_status }.
  // The flat invite_yours/invite_theirs names belong to the BFF's partner row, not to haiCore's response.
  it('forwards to haiCore and clears both invites', async () => {
    const payload = { connection_id: 'conn-1', relationship_state: 'approved', invite_status: { requestor_invite: false, counterparty_invite: false } };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const res = await POST(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'conn-1' }) });
    expect(fetchRaw).toHaveBeenCalledWith('/connections/conn-1/decline-activation', expect.objectContaining({ method: 'POST' }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/account/connections/[id]/activate src/app/api/account/connections/[id]/decline-activation`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write the implementations**

```typescript
// src/app/api/account/connections/[id]/activate/route.ts
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** POST /api/account/connections/:id/activate — D-146 closure (spec §3.3). */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, params }) => forwardHaiCoreResponse(await client.fetchRaw(`/connections/${encodeURIComponent(params.id)}/activate`, { method: 'POST' })),
  { role: 'account_admin' },
);
```

```typescript
// src/app/api/account/connections/[id]/decline-activation/route.ts
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

export const POST = withHaiCore<{ id: string }>(
  async ({ client, params }) => forwardHaiCoreResponse(await client.fetchRaw(`/connections/${encodeURIComponent(params.id)}/decline-activation`, { method: 'POST' })),
  { role: 'account_admin' },
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/account/connections/[id]/activate src/app/api/account/connections/[id]/decline-activation`
Expected: PASS, 4 tests. Read the reporter for `(retry x1)`/`(retry x2)` markers — a retried green is not a green. The pin check and `npm run build` run at the Batch 2 gate.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/connections/\[id\]/activate src/app/api/account/connections/\[id\]/decline-activation
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(bff): D-146 activate/decline-activation routes

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 5: Partners-panel UI — premier designation and D-146 activation

> **Amended:** PF P13 (**two arms of this surface are inert against the as-built wire** — see the box below), PF P14 (its two test files query `getByRole('tab', …)`, so this task **depends on Task 0**), PF P22 (the decline response shape), PF P30 (citation).

> **PF P13 — inert arms, ruled Q1: build it anyway.** `ActiveConnection` (haiCore `apps/core/src/services/connection-service.ts:40-50`) projects nine fields and **neither `trust_class` nor `pending_activation_at`**, though both columns exist (`apps/core/src/db/schema/connections.ts:22-23`). Two consequences, measured at `16b31655`:
>
> - **Premier renders, on one arm only.** The button keys on `p.status === "trading_pair"`, which is `relationship_state` and *is* on the wire, so the gesture works and the PUT reaches a route that exists. But `p.trust_class` is always `undefined`, so the label can never read "Lower from Premier" and a premier partner looks like any trading pair.
> - **The D-146 branch does not render at all.** Accept/Decline keys on `p.pending_activation_at`, always `undefined`, so the `else` arm always wins and Task 4's two routes have no surface.
>
> The BFF remap and the UI are **correct as a passthrough** and are built now, so the surface lights up the day haiCore projects the two fields; that projection is an **owner item**, not L7's. The tests below hand the components fixtures that carry both fields, so they test the UI, which is right — not the wire, which is not.

**Files:**
- Modify: `src/lib/mock-types.ts:36-46` (`MockPartner`)
- Modify: `src/app/api/account/partners/route.ts:25-35` (field remap)
- Modify: `src/app/account/partners/partners-panel.tsx` (`:202`, `:266-280`, `:407-438`, `:817-821`, plus new state/handlers/modal)
- Test: `src/app/api/account/partners/__tests__/route.test.ts` (extend)
- Test: `src/app/account/partners/__tests__/partners-panel-premier.test.tsx` (new)
- Test: `src/app/account/partners/__tests__/partners-panel-activation.test.tsx` (new)

**Interfaces:**
- Consumes: `PUT /api/account/connections/:id/premier` (Task 3), `POST /api/account/connections/:id/{activate,decline-activation}` (Task 4), `TRUST_CLASS_LABEL` (`trust-class-label.ts`).
- Design: `trust_class` and `pending_activation_at` are added to `MockPartner` as **optional** — `mock-data.ts:154-161`'s six literal `MockPartner` entries (the `withHaiCore` fallback for `GET /api/account/partners`) would otherwise fail `npm run build`'s typecheck (vitest's esbuild transform would not catch this). Optional avoids touching `mock-data.ts`, and it is also the honest typing while haiCore does not project either field (PF P13).
- Depends on **Task 0**: both new test files query `getByRole('tab', { name: /Active/ })`, which the shared `Tabs` component cannot satisfy until Batch 0 lands.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/mock-types.ts — extend MockPartner (:36-46) and its import (:6)
import type { UserRole } from "./auth";
import type { TrustClass } from "@haiwave/protocol";
// ...
export interface MockPartner {
  id: string;
  company_name: string;
  status: "approved" | "trading_pair";
  established_at: string;
  location: string;
  industry: string;
  invite_yours: boolean;
  invite_theirs: boolean;
  connection_id: string;
  /** Optional: absent from MOCK_PARTNERS fallback data; present from live haiCore. */
  trust_class?: TrustClass;
  pending_activation_at?: string | null;
}
```

```typescript
// src/app/api/account/partners/__tests__/route.test.ts — add to the existing describe block
it('passes trust_class and pending_activation_at through when haiCore includes them', async () => {
  state.connections = [{
    connection_id: 'conn-1', partner_participant_id: 'p-acme', partner_name: 'Acme Metals',
    partner_location: 'Ohio', partner_industry: 'Metals', relationship_state: 'trading_pair',
    invite_yours: true, invite_theirs: true, established_at: '2026-08-01T00:00:00Z',
    trust_class: 'premier_partner', pending_activation_at: null,
  }];
  const res = await GET(requestFor('GET', '/api/account/partners'), { params: Promise.resolve({}) });
  const [partner] = await res.json();
  expect(partner.trust_class).toBe('premier_partner');
  expect(partner.pending_activation_at).toBeNull();
});
```

```tsx
// src/app/account/partners/__tests__/partners-panel-premier.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/use-api', () => ({ useApi: vi.fn(() => ({ data: [], loading: false })) }));

// PF P13: the fixture carries trust_class because the UI must handle it; the as-built wire does not
// send it yet, so on a live console this component renders its "Raise to Premier" arm only.
const partner = {
  id: 'p-acme', company_name: 'Acme Metals', status: 'trading_pair' as const,
  established_at: '2026-08-01T00:00:00Z', location: 'Ohio', industry: 'Metals',
  invite_yours: true, invite_theirs: true, connection_id: 'conn-1', trust_class: 'trading_pair' as const,
};

describe('PartnersPanel premier designation', () => {
  it('shows "Raise to Premier" for a trading_pair partner and PUTs premier:true after confirm', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [partner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Raise to Premier' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Raise to Premier' })[1]);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/connections/conn-1/premier', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ premier: true }) })));
  });

  it('shows no premier button for a partner at status "approved"', async () => {
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [{ ...partner, status: 'approved' as const, trust_class: 'behavioral_only' as const }], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    expect(screen.queryByRole('button', { name: /Premier/ })).not.toBeInTheDocument();
  });
});
```

```tsx
// src/app/account/partners/__tests__/partners-panel-activation.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/use-api', () => ({ useApi: vi.fn() }));

// PF P13: the fixture carries pending_activation_at because the UI must handle it; the as-built
// wire does not send it yet, so on a live console this branch does not render at all.
const pendingPartner = {
  id: 'p-acme', company_name: 'Acme Metals', status: 'approved' as const,
  established_at: '2026-08-01T00:00:00Z', location: 'Ohio', industry: 'Metals',
  invite_yours: true, invite_theirs: true, connection_id: 'conn-1', pending_activation_at: '2026-09-16T00:00:00Z',
};

describe('PartnersPanel D-146 activation', () => {
  it('shows Accept/Decline instead of Withdraw/Propose when pending_activation_at is set', async () => {
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    expect(screen.getByRole('button', { name: 'Accept Trading Pair' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Propose Trading Pair/ })).not.toBeInTheDocument();
  });

  it('POSTs to activate on Accept', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ relationship_state: 'trading_pair' }) }));
    const { useApi } = await import('@/lib/use-api');
    (useApi as ReturnType<typeof vi.fn>).mockReturnValue({ data: [pendingPartner], loading: false });
    const { PartnersPanel } = await import('../partners-panel');
    render(<PartnersPanel />);
    fireEvent.click(screen.getByRole('tab', { name: /Active/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept Trading Pair' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/connections/conn-1/activate', expect.objectContaining({ method: 'POST' })));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/account/partners src/app/account/partners`
Expected: FAIL — passthrough fields absent; no premier or Accept/Decline buttons rendered.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/account/partners/route.ts — extend the mapped shape (:12-35)
export const GET = withHaiCore(
  async ({ client }) => {
    const result = (await client.listActiveConnections()) as unknown as Array<{
      connection_id: string; partner_participant_id: string; partner_name: string;
      partner_location: string; partner_industry: string; relationship_state: string;
      invite_yours: boolean; invite_theirs: boolean; established_at: string;
      trust_class?: string; pending_activation_at?: string | null;
    }>;
    return result.map((c) => ({
      id: c.partner_participant_id, company_name: c.partner_name, status: c.relationship_state,
      established_at: c.established_at, location: c.partner_location, industry: c.partner_industry,
      invite_yours: c.invite_yours, invite_theirs: c.invite_theirs, connection_id: c.connection_id,
      trust_class: c.trust_class, pending_activation_at: c.pending_activation_at ?? null,
    }));
  },
  { fallback: MOCK_PARTNERS },
);
```

In `partners-panel.tsx`, add state beside `:69-71`: `const [premierPartner, setPremierPartner] = useState<MockPartner | null>(null);`. Add handlers beside `handleSetInvite` (`:266-280`):

```typescript
async function handleTogglePremier() {
  if (!premierPartner) return;
  const raising = premierPartner.trust_class !== 'premier_partner';
  const res = await confirmed(fetch(`/api/account/connections/${premierPartner.connection_id}/premier`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ premier: raising }) }));
  setPremierPartner(null);
  if (!res) return;
  setPartners((prev) => prev.map((p) => p.id === premierPartner.id ? { ...p, trust_class: raising ? 'premier_partner' : 'trading_pair' } : p));
  showToast(raising ? `Raised ${premierPartner.company_name} to Premier` : `Lowered ${premierPartner.company_name} from Premier`);
}

async function handleActivate(p: MockPartner) {
  const res = await confirmed(fetch(`/api/account/connections/${p.connection_id}/activate`, { method: 'POST' }));
  if (!res) return;
  setPartners((prev) => prev.map((x) => x.id === p.id ? { ...x, status: 'trading_pair' as const, pending_activation_at: null } : x));
  showToast(`Activated trading pair with ${p.company_name}`);
}

async function handleDeclineActivation(p: MockPartner) {
  const res = await confirmed(fetch(`/api/account/connections/${p.connection_id}/decline-activation`, { method: 'POST' }));
  if (!res) return;
  setPartners((prev) => prev.map((x) => x.id === p.id ? { ...x, invite_yours: false, invite_theirs: false, pending_activation_at: null } : x));
  showToast(`Declined trading pair activation with ${p.company_name}`);
}
```

Replace the Withdraw/Propose button in `partnerColumns` (`:423-429`), branching on `pending_activation_at`, and add the premier button after it:

```tsx
{p.pending_activation_at ? (
  <>
    <Button size="sm" onClick={() => handleActivate(p)}>Accept Trading Pair</Button>
    <Button size="sm" variant="ghost" onClick={() => handleDeclineActivation(p)}>Decline</Button>
  </>
) : (
  <Button size="sm" variant={p.invite_yours ? "ghost" : "secondary"} onClick={() => setInvitePartner(p)}>
    {p.invite_yours ? "Withdraw Trading Pair" : "Propose Trading Pair"}
  </Button>
)}
{p.status === "trading_pair" && (
  <Button size="sm" variant="ghost" onClick={() => setPremierPartner(p)}>
    {p.trust_class === "premier_partner" ? "Lower from Premier" : "Raise to Premier"}
  </Button>
)}
```

Replace the toast copy in `handleApproveWithInvite` (`:202`) and the "already proposed" block in the Invite Consent Modal (`:817-821` — PF P30; `:816` is the closing `</div>` above it) to reflect pending-activation rather than immediate activation:

```typescript
showToast(`Approved as trading partner — ${req.company_name}${req.invite ? " (Trading Pair Active)" : " (awaiting activation once both invites are set)"}`);
```

```tsx
{invitePartner?.invite_theirs && (
  <div className="bg-success/5 border border-success/20 rounded-lg px-4 py-3 text-sm text-success">
    {invitePartner.company_name} has already proposed. Confirming yours will move the pair to pending activation — either side&apos;s account_admin can then accept from the Active list.
  </div>
)}
```

Add a premier confirmation modal after the Invite Consent Modal (`:831`):

```tsx
<Modal open={!!premierPartner} onClose={() => setPremierPartner(null)} title={premierPartner?.trust_class === "premier_partner" ? "Lower from Premier" : "Raise to Premier"}>
  <div className="space-y-4">
    <p className="text-sm text-charcoal">
      {premierPartner?.trust_class === "premier_partner"
        ? <>Lower <strong>{premierPartner?.company_name}</strong> from Premier back to Trading Pair?</>
        : <>Raise <strong>{premierPartner?.company_name}</strong> to Premier? This is unilateral and needs no acceptance from them.</>}
    </p>
    <div className="flex gap-3 justify-end">
      <Button variant="secondary" onClick={() => setPremierPartner(null)}>Cancel</Button>
      <Button onClick={handleTogglePremier}>{premierPartner?.trust_class === "premier_partner" ? "Lower" : "Raise to Premier"}</Button>
    </div>
  </div>
</Modal>
```

- [ ] **Step 4: Run the tests to verify they pass, then build**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run src/app/api/account/connections src/app/api/account/partners src/app/account/partners
npm run build
```
Expected: vitest PASS — read the reporter for `(retry x1)`/`(retry x2)` markers, a retried green is not a green. `npm run build` exits 0 (`MockPartner` is widened here, and only the build sees it). This is the Batch 2 gate, so it runs Tasks 3 and 4's suites too.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock-types.ts src/app/api/account/partners/route.ts src/app/account/partners
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(partners): premier designation and D-146 activation UI

Two arms are inert until haiCore projects trust_class and pending_activation_at
on the active-connections list (PF P13, owner item).

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 6: Inquiry log BFF routes (list + detail)

> **Amended:** PF P15 (**the portal client does not carry `inquiry:ask` — this surface 403s for every console user today**; ruling Q3: ship it, and map the 403 to a fixed empty state), PF P16 + PF P18 (the verdict union is L0's, imported, not re-declared), PF P19 (`unit` survives with it), PF P20 (the list row's outcome is nullable), PF P21 (the guard field is an inbound-only indicator).

> **PF P15 — this surface is scope-blocked upstream, ruled Q3.** `GET /inquiries` and `GET /inquiries/:id` both require `SCOPES.INQUIRY_ASK` (haiCore `apps/core/src/routes/inquiries.ts:112` and `:97`). At `16b31655` that scope is a default client scope on the 26 `*-agent` Keycloak clients only (`infrastructure/keycloak/apply-inquiry-scopes.mjs:73`); `haiwave-portal` (`src/config/env.ts:24`) is not among them, and the BFF forwards the **user's** token. So until the owner grants `inquiry:ask` to the portal client — a **deploy item on the live realm, not an L7 change** — both routes answer 403 for every signed-in console user. The code is correct and ships now; the BFF turns that 403 into one fixed, non-leaking empty state so the console says what is happening instead of showing a bare error.
>
> The mapping cannot distinguish a scope 403 from spec §13's fixed "not yours / no such inquiry" 403 — haiCore returns the same status for both, deliberately. So while the scope is missing, an unauthorized id also shows the not-enabled state rather than a not-found page. That keeps the existence oracle closed (every refused id looks identical); it is a stated consequence of the mapping, not an oversight.

**Files:**
- Create: `src/app/api/account/sonar/inquiries/route.ts`
- Create: `src/app/api/account/sonar/inquiries/[id]/route.ts`
- Test: matching `__tests__/route.test.ts` beside each

**Interfaces:**
- Produces (appended to `safe-room-types.ts`): `InquiryOutcome`; `InquiryDirection`; `InquiryLogRow` (list row — never value, nonce or document); `InquiryListResponse`; `InquiryNotEnabled` + `INQUIRY_NOT_ENABLED_MESSAGE`; `InquiryDetailResponse`.
- **Imports, does not re-declare (PF P16, PF P18).** L0 added `InquiryPendingSchema` / `InquiryOutcomeOrPendingSchema` / `isPending` to `packages/protocol/src/inquiry/verdict.ts` for exactly this consumer, and the protocol barrel test at `packages/protocol/src/__tests__/version-3.88.0.test.ts:26-28` asserts they are exported. The verdict is a **two-member union**: an *answered* member with `form_answered`, `granularity`, `basis`, `commitment` and an optional `value`/`unit`/`condition`, and a **`.strict()` silent member with exactly three keys** (`inquiry_id`, `outcome: 'declined' | 'unavailable'`, `informational_use_only`). A single flat interface over both renders `undefined` for a declined inquiry, which is what the pre-amendment plan did.
- **L3-confirmed wire contract, re-measured at `16b31655`:** `GET /api/v1/inquiries?direction=&limit=&cursor=` returns `{ rows, next_cursor }`; `direction` is `z.enum(['inbound','outbound']).default('inbound')`, `limit` is 1..200 default 50, `cursor` is at most 200 characters, and a bad value is a fixed `400 VALIDATION_ERROR` propagated verbatim. The participant comes from the JWT via the participant-scoped `client` — the BFF never places a participant id in the query string. `GET /api/v1/inquiries/:id` returns an `InquiryVerdict` or `{ inquiry_id, status: 'pending' }` (both 200), and one fixed 403 otherwise.
- Consumes: `withHaiCore`, `forwardHaiCoreResponse`, `NextResponse`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/account/sonar/inquiries/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/sonar/inquiries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('defaults to direction=inbound and limit=50 when absent', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ rows: [], next_cursor: null }) });
    await GET(new NextRequest('http://x/api/account/sonar/inquiries'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/inquiries?direction=inbound&limit=50');
  });

  it('forwards direction, limit and cursor when given, and never places a participant id in the query string', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ rows: [], next_cursor: null }) });
    await GET(new NextRequest('http://x/api/account/sonar/inquiries?direction=outbound&limit=100&cursor=cur-1'), { params: Promise.resolve({}) });
    const calledPath = fetchRaw.mock.calls[0][0] as string;
    expect(calledPath).toBe('/inquiries?direction=outbound&limit=100&cursor=cur-1');
    expect(calledPath).not.toContain('participant');
  });

  it('returns the upstream { rows, next_cursor } envelope verbatim, and a 400 for an over-large limit verbatim', async () => {
    const payload = { rows: [{ inquiry_id: 'inq-1', outcome: 'satisfied' }], next_cursor: 'cur-2' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(payload) });
    const okRes = await GET(new NextRequest('http://x/api/account/sonar/inquiries'), { params: Promise.resolve({}) });
    expect(await okRes.json()).toEqual(payload);

    fetchRaw.mockResolvedValueOnce({ status: 400, text: async () => JSON.stringify({ error: { code: 'VALIDATION_ERROR' } }) });
    const badRes = await GET(new NextRequest('http://x/api/account/sonar/inquiries?limit=500'), { params: Promise.resolve({}) });
    expect(badRes.status).toBe(400);
  });

  // PF P15 / Q3 — the portal client has no inquiry:ask today.
  it('maps an upstream 403 to a 200 empty state flagged not_enabled', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 403, text: async () => JSON.stringify({ error: { code: 'FORBIDDEN' } }) });
    const res = await GET(new NextRequest('http://x/api/account/sonar/inquiries'), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rows: [], next_cursor: null, not_enabled: true });
  });
});
```

```typescript
// src/app/api/account/sonar/inquiries/[id]/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET } from '../route';

describe('GET /api/account/sonar/inquiries/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('forwards to /inquiries/:id and returns an answered verdict body verbatim', async () => {
    const verdict = { inquiry_id: '22222222-2222-4222-8222-222222222222', outcome: 'satisfied', form_answered: 'qualified', granularity: 'aggregate', basis: 'declared_value', informational_use_only: true, commitment: { commitment_id: 'cm-1', hash: 'h'.repeat(8), signature: 's'.repeat(8), signed_at: '2026-09-16T00:00:00Z' } };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(verdict) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'inq-1' }) });
    expect(fetchRaw).toHaveBeenCalledWith('/inquiries/inq-1');
    expect(await res.json()).toEqual(verdict);
  });

  it('returns a { inquiry_id, status: "pending" } body verbatim while the inquiry is unanswered', async () => {
    const pending = { inquiry_id: '33333333-3333-4333-8333-333333333333', status: 'pending' };
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(pending) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'inq-2' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(pending);
  });

  // PF P15 / Q3 — the same fixed state as the list route, for both causes of a 403.
  it('maps the upstream 403 to the fixed not-enabled state rather than leaking which cause it was', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 403, text: async () => JSON.stringify({ error: { code: 'FORBIDDEN' } }) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({ id: 'not-mine' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ not_enabled: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/account/sonar/inquiries`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Write the implementations**

```typescript
// src/lib/safe-room-types.ts — append

// ─── Qualified inquiries (spec §6.4, §11; as-built at 16b31655) ───
export type InquiryOutcome = 'satisfied' | 'satisfied_with_condition' | 'not_satisfied' | 'declined' | 'unavailable';
export type InquiryDirection = 'inbound' | 'outbound';

export interface InquiryLogRow {
  inquiry_id: string;
  requester_participant_id: string;
  responder_participant_id: string;
  subjects: unknown[]; // spec §6.1 discriminated union (sku/product_class/component_ref/facility/participant); not further typed here
  attribute_class_id: string;
  tier_at_request: TrustClass;
  /** The row's lifecycle status — distinct from `outcome`, and narrowed to the as-built five (PF P20). */
  status: 'dispatched' | 'pending' | 'answered' | 'declined' | 'unavailable';
  /** null on a dispatched or pending row (PF P20). */
  outcome: InquiryOutcome | null;
  commitment_id: string | null;
  /**
   * A 0/1 INDICATOR, not a count: no table links a guard trip to an inquiry, and the room stores
   * one rule type, so it can never exceed 1. It is 0 on every outbound row by construction, which
   * is why only the inbound view renders it (PF P21).
   */
  guard_trip_count: number;
  created_at: string;
}

/** PF P15 / ruling Q3: the one console state when haiCore refuses the inquiry scope. */
export const INQUIRY_NOT_ENABLED_MESSAGE = 'Inquiry log is not enabled for this console';
export interface InquiryNotEnabled {
  not_enabled: true;
}

export interface InquiryListResponse {
  rows: InquiryLogRow[];
  next_cursor: string | null;
  /** Set by the BFF only, when the upstream refused with 403 (PF P15). */
  not_enabled?: true;
}

/**
 * The detail body. The verdict union and its pending member are L0's — imported, never
 * re-declared (PF P16, PF P18), which is also how `unit` survives on the answered member (PF P19).
 */
export type InquiryDetailResponse = InquiryOutcomeOrPending | InquiryNotEnabled;
```

and extend the file's import line to `import type { AttributeClass, InquiryOutcomeOrPending, TrustClass } from '@haiwave/protocol';`.

```typescript
// src/app/api/account/sonar/inquiries/route.ts
import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

const DEFAULT_LIMIT = 50;

/**
 * GET /api/account/sonar/inquiries?direction=inbound|outbound&limit=&cursor=
 * The participant comes from the JWT via the participant-scoped `client`, never from the
 * query string. haiCore validates `direction`, `limit` (1..200) and `cursor`, and returns a
 * fixed 400 on any of them, propagated verbatim.
 *
 * PF P15 (ruling Q3): upstream requires the inquiry:ask scope, which the portal client does not
 * carry at 16b31655, so a 403 here is expected in production today. Map it to one fixed empty
 * state instead of an error the page cannot explain.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const params = request.nextUrl.searchParams;
  const qs = new URLSearchParams({
    direction: params.get('direction') ?? 'inbound',
    limit: params.get('limit') ?? String(DEFAULT_LIMIT),
  });
  const cursor = params.get('cursor');
  if (cursor) qs.set('cursor', cursor);
  const res = await client.fetchRaw(`/inquiries?${qs.toString()}`);
  if (res.status === 403) return NextResponse.json({ rows: [], next_cursor: null, not_enabled: true }, { status: 200 });
  return forwardHaiCoreResponse(res);
});
```

```typescript
// src/app/api/account/sonar/inquiries/[id]/route.ts
import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/**
 * GET /api/account/sonar/inquiries/:id — returns an InquiryVerdict or an InquiryPending body
 * (both 200) verbatim. Upstream answers one fixed 403 for "not yours", "no such inquiry" AND a
 * missing inquiry:ask scope; the three are indistinguishable by design (spec §13), so the BFF
 * maps all of them to the same not-enabled state (PF P15, ruling Q3).
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  const res = await client.fetchRaw(`/inquiries/${encodeURIComponent(params.id)}`);
  if (res.status === 403) return NextResponse.json({ not_enabled: true }, { status: 200 });
  return forwardHaiCoreResponse(res);
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/api/account/sonar/inquiries`
Expected: PASS, 7 tests. Read the reporter for `(retry x1)`/`(retry x2)` markers — a retried green is not a green. Then run `npm run build`: `safe-room-types.ts` is extended here and the build is the only thing that checks it against the protocol's verdict union.

- [ ] **Step 5: Commit**

```bash
git add src/lib/safe-room-types.ts src/app/api/account/sonar/inquiries
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(bff): inquiry log list and detail routes, with the 403 not-enabled state

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 7: Inquiry log list page, inbound/outbound tabs, cursor pagination, nav entry

> **Amended:** PF P14 (**depends on Task 0** — its tab assertions need the shared component's ARIA), PF P15 (render the fixed not-enabled state the BFF sends), PF P20 (a row's outcome can be null), PF P21 (guard trip is an inbound-only Yes/No indicator), PF P23 (import the trust-class labels instead of re-declaring them).

**Files:**
- Create: `src/app/account/sonar/inquiries/_components/inquiry-history-table.tsx`
- Create: `src/app/account/sonar/inquiries/_components/inquiries-client.tsx`
- Create: `src/app/account/sonar/inquiries/page.tsx`
- Modify: `src/components/account-nav.tsx:119-129`
- Test: `src/app/account/sonar/inquiries/_components/__tests__/inquiries-client.test.tsx`
- Test: `src/app/account/sonar/inquiries/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `fetchBffJson`, `Tabs` (`src/components/tabs.tsx:15-40`, **as amended by Task 0**), `DataTable`/`Column`, `InquiryLogRow`/`InquiryListResponse`/`INQUIRY_NOT_ENABLED_MESSAGE` (Task 6), `TRUST_CLASS_LABEL` (`trust-class-label.ts:3-8`, imported — **PF P23**).
- Design: `page.tsx` is the server component; `inquiries-client.tsx` is `'use client'` and owns the tab toggle plus a "Load more" fetch against `next_cursor` (the wire contract is cursor-paginated, so pagination is genuinely new client behavior, not cosmetic — it gets its own test). `InquiryLogRow` carries no `value` field, so the list table cannot leak one regardless of tier. The row carries only `requester_participant_id`, no company name; P6 (the spec's own ruling id — requester identity always visible) is satisfied by always rendering the participant id, the identity the wire actually carries.
- **The guard column is inbound-only (PF P21).** `guard_trip_count` is a 0/1 indicator and is 0 on every outbound row **by construction** — a guard-trip oracle over the six byte-equal declines was closed at `b0296ac7`. A column of permanent zeros on the outbound tab would invite the reader to conclude their own requests tripped no guard, which the data cannot support. So `InquiryHistoryTable` takes a `direction` prop, includes the column only for `inbound`, heads it "Guard trip" and renders Yes/No.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/app/account/sonar/inquiries/_components/__tests__/inquiries-client.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InquiriesClient } from '../inquiries-client';
import type { InquiryLogRow } from '@/lib/safe-room-types';

const row: InquiryLogRow = {
  inquiry_id: 'inq-1', requester_participant_id: 'p-req', responder_participant_id: 'p-1',
  subjects: [{ kind: 'sku' }], attribute_class_id: 'availability', tier_at_request: 'trading_pair',
  status: 'answered', outcome: 'satisfied', commitment_id: 'cm-1', guard_trip_count: 0, created_at: '2026-09-16T00:00:00Z',
};

describe('InquiriesClient', () => {
  it('shows Load more only when a next cursor exists, fetches with it, and appends the returned rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rows: [{ ...row, inquiry_id: 'inq-2' }], next_cursor: null }) }));
    render(<InquiriesClient inbound={{ rows: [row], nextCursor: 'cur-1' }} outbound={{ rows: [], nextCursor: null }} notEnabled={false} error={null} />);
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/sonar/inquiries?direction=inbound&cursor=cur-1'));
    await waitFor(() => expect(screen.getAllByText('p-req')).toHaveLength(2)); // original row + the appended one, both fixture rows share this requester
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows no Load more button on the outbound tab when its next cursor is null', () => {
    render(<InquiriesClient inbound={{ rows: [row], nextCursor: 'cur-1' }} outbound={{ rows: [], nextCursor: null }} notEnabled={false} error={null} />);
    fireEvent.click(screen.getByRole('tab', { name: /Outbound/ }));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  // PF P21 — the indicator is inbound-only; the present control is the inbound header in the same test.
  it('renders the guard-trip column on the inbound tab and not on the outbound tab', () => {
    render(<InquiriesClient inbound={{ rows: [row], nextCursor: null }} outbound={{ rows: [{ ...row, inquiry_id: 'inq-3' }], nextCursor: null }} notEnabled={false} error={null} />);
    expect(screen.getByText('Guard trip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Outbound/ }));
    expect(screen.queryByText('Guard trip')).not.toBeInTheDocument();
  });

  // PF P15 / Q3 — what every console user sees until the portal client is granted the scope.
  it('renders the fixed not-enabled state instead of an empty table when the BFF flags it', () => {
    render(<InquiriesClient inbound={{ rows: [], nextCursor: null }} outbound={{ rows: [], nextCursor: null }} notEnabled error={null} />);
    expect(screen.getByText('Inquiry log is not enabled for this console')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
```

```typescript
// src/app/account/sonar/inquiries/__tests__/page.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/server-fetch', () => ({
  fetchBffJson: vi.fn(async () => ({
    kind: 'ok',
    data: { rows: [{
      inquiry_id: 'inq-1', requester_participant_id: 'p-req', responder_participant_id: 'p-1',
      subjects: [{ kind: 'sku' }], attribute_class_id: 'availability', tier_at_request: 'trading_pair',
      status: 'answered', outcome: 'satisfied', commitment_id: 'cm-1', guard_trip_count: 0, created_at: '2026-09-16T00:00:00Z',
    }], next_cursor: null },
  })),
}));

import InquiriesPage from '../page';

describe('InquiriesPage', () => {
  it('defaults to the inbound tab and shows the requester participant id', async () => {
    const el = await InquiriesPage();
    render(el);
    expect(screen.getByText('p-req')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Inbound/, selected: true })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/account/sonar/inquiries`
Expected: FAIL — none of the modules exist. (If a `getByRole('tab', …)` assertion is the only failure, Task 0 has not landed — stop and land Batch 0 first.)

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/account/sonar/inquiries/_components/inquiry-history-table.tsx
'use client';

import Link from 'next/link';
import { DataTable, type Column } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { TRUST_CLASS_LABEL } from '@/app/account/sonar/posture/trust-bypass/_components/trust-class-label';
import type { InquiryDirection, InquiryLogRow } from '@/lib/safe-room-types';

export function InquiryHistoryTable({ rows, direction }: { rows: InquiryLogRow[]; direction: InquiryDirection }) {
  const columns: Column<InquiryLogRow>[] = [
    { key: 'requester', label: 'Requester', render: (r) => r.requester_participant_id },
    { key: 'subject', label: 'Subject', render: (r) => `${r.subjects.length} subject${r.subjects.length === 1 ? '' : 's'}` },
    { key: 'attribute', label: 'Attribute', render: (r) => r.attribute_class_id },
    { key: 'tier', label: 'Tier', render: (r) => TRUST_CLASS_LABEL[r.tier_at_request] },
    { key: 'status', label: 'Status', render: (r) => r.status },
    // PF P20: a dispatched or pending row carries no outcome.
    { key: 'outcome', label: 'Outcome', render: (r) => (r.outcome ? <StatusBadge status={r.outcome} /> : '—') },
    { key: 'commitment', label: 'Commitment', render: (r) => r.commitment_id ?? '—' },
    // PF P21: a 0/1 indicator, and 0 on every outbound row by construction — so it is inbound-only.
    ...(direction === 'inbound'
      ? [{ key: 'guard', label: 'Guard trip', render: (r: InquiryLogRow) => (r.guard_trip_count ? 'Yes' : 'No') } as Column<InquiryLogRow>]
      : []),
    { key: 'actions', label: '', render: (r) => <Link href={`/account/sonar/inquiries/${r.inquiry_id}`} className="text-xs text-teal hover:text-navy font-medium">View &rsaquo;</Link> },
  ];
  return <DataTable columns={columns} data={rows} keyFn={(r) => r.inquiry_id} emptyMessage="No inquiries." />;
}
```

```tsx
// src/app/account/sonar/inquiries/_components/inquiries-client.tsx
'use client';

import { useState } from 'react';
import { PageHeader, Button } from '@/components';
import { Tabs } from '@/components/tabs';
import { InquiryHistoryTable } from './inquiry-history-table';
import { INQUIRY_NOT_ENABLED_MESSAGE, type InquiryDirection, type InquiryLogRow } from '@/lib/safe-room-types';

interface DirectionState { rows: InquiryLogRow[]; nextCursor: string | null }

export function InquiriesClient({ inbound, outbound, notEnabled, error }: { inbound: DirectionState; outbound: DirectionState; notEnabled: boolean; error: string | null }) {
  const [tab, setTab] = useState<InquiryDirection>('inbound');
  const [state, setState] = useState<Record<InquiryDirection, DirectionState>>({ inbound, outbound });
  const [loadingMore, setLoadingMore] = useState(false);
  const current = state[tab];

  async function loadMore() {
    if (!current.nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/account/sonar/inquiries?direction=${tab}&cursor=${encodeURIComponent(current.nextCursor)}`);
      if (!res.ok) return;
      const payload = (await res.json()) as { rows: InquiryLogRow[]; next_cursor: string | null };
      setState((prev) => ({ ...prev, [tab]: { rows: [...prev[tab].rows, ...payload.rows], nextCursor: payload.next_cursor } }));
    } finally {
      setLoadingMore(false);
    }
  }

  const header = <PageHeader title="Inquiry Log" description="Qualified inquiries sent to you and by you — verdicts, commitments, and guard activity. There is no composer here; inquiries are made by your agent." />;

  // PF P15 (Q3): upstream refused the inquiry scope. One fixed state, no table, no pagination.
  if (notEnabled) {
    return (
      <div className="space-y-6">
        {header}
        <p className="rounded-md border border-slate/15 bg-light-gray px-4 py-3 text-sm text-slate">{INQUIRY_NOT_ENABLED_MESSAGE}</p>
      </div>
    );
  }

  const tabs = [{ key: 'inbound', label: 'Inbound', count: state.inbound.rows.length }, { key: 'outbound', label: 'Outbound', count: state.outbound.rows.length }];
  return (
    <div className="space-y-6">
      {header}
      {error && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{error}</div>}
      <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as InquiryDirection)} />
      <InquiryHistoryTable rows={current.rows} direction={tab} />
      {current.nextCursor && (
        <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load more'}</Button>
      )}
    </div>
  );
}
```

```tsx
// src/app/account/sonar/inquiries/page.tsx
import { fetchBffJson } from '@/lib/server-fetch';
import { InquiriesClient } from './_components/inquiries-client';
import type { InquiryListResponse } from '@/lib/safe-room-types';

export default async function InquiriesPage() {
  const [inboundRes, outboundRes] = await Promise.all([
    fetchBffJson<InquiryListResponse>('/api/account/sonar/inquiries?direction=inbound'),
    fetchBffJson<InquiryListResponse>('/api/account/sonar/inquiries?direction=outbound'),
  ]);
  const inbound = inboundRes.kind === 'ok' ? inboundRes.data : { rows: [], next_cursor: null };
  const outbound = outboundRes.kind === 'ok' ? outboundRes.data : { rows: [], next_cursor: null };
  const error = inboundRes.kind === 'error' ? inboundRes.message : outboundRes.kind === 'error' ? outboundRes.message : null;
  // PF P15: either direction being scope-refused means the surface is off for this console.
  const notEnabled = Boolean(('not_enabled' in inbound && inbound.not_enabled) || ('not_enabled' in outbound && outbound.not_enabled));
  return (
    <InquiriesClient
      inbound={{ rows: inbound.rows, nextCursor: inbound.next_cursor }}
      outbound={{ rows: outbound.rows, nextCursor: outbound.next_cursor }}
      notEnabled={notEnabled}
      error={error}
    />
  );
}
```

```tsx
// src/components/account-nav.tsx — Sonar Observe (:119-129), after Request Management
{ href: "/account/sonar/inquiries", label: "Inquiry Log", tooltip: "Qualified inquiries sent to you and by you — verdicts, commitments, and guard activity." },
```

- [ ] **Step 4: Run the tests to verify they pass, then build**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run src/app/account/sonar/inquiries
npm run build
```
Expected: vitest PASS, 5 tests; read the reporter for `(retry x` markers. `npm run build` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/inquiries src/components/account-nav.tsx
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(inquiries): list page, inbound/outbound tabs, cursor pagination, nav entry

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 8: Inquiry detail page

> **Amended:** PF P16 + PF P18 (the verdict is a **two-member union** imported from the protocol, branched per member), PF P17 (**the raw-value panel is deleted** — D-222 makes it unreachable and it advertises a posture the platform closed), PF P15 (render the not-enabled state), PF P19 (`unit` stays on the type).

**Files:**
- Create: `src/app/account/sonar/inquiries/[id]/page.tsx`
- Test: `src/app/account/sonar/inquiries/[id]/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `fetchBffJson`, `notFound` (`next/navigation`), `InquiryDetailResponse` / `INQUIRY_NOT_ENABLED_MESSAGE` (Task 6), and `isPending` from `@haiwave/protocol`.
- Design: copies `sonar/audit/[run_id]/page.tsx:40-44`'s "`notFound()` on ANY error" rule, so a transport failure is indistinguishable from anything else. Four render arms, in this order: **not-enabled** (the BFF's 403 mapping, PF P15), **pending** (`isPending`), the **silent** verdict member, then the **answered** member.
- **The verdict union (PF P16).** The answered member carries `form_answered`, `granularity`, `basis`, `commitment` and optional `value` / `unit` / `condition`. The silent member is `.strict()` with exactly three keys — `inquiry_id`, `outcome` (`declined` or `unavailable`) and `informational_use_only` — so reading `basis` or `granularity` on a declined inquiry renders the literal text `undefined`. The silent arm is detected with `!('commitment' in inq)`.
- **No raw value on this page (PF P17).** `GET /inquiries/:id` **always** re-serves the verdict in QUALIFIED form: the value a raw verdict carried was never persisted, so a re-read cannot serve one (haiCore `apps/core/src/services/inquiry/inquiry-room-service.ts:807-811`, D-222). A "Value:" panel here is therefore unreachable code that also advertises a disclosure posture D-222 deliberately closed. It is replaced by one sentence of text, and a red pins its absence.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/account/sonar/inquiries/[id]/__tests__/page.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const notFound = vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); });
vi.mock('next/navigation', () => ({ notFound }));

const ANSWERED = {
  inquiry_id: '22222222-2222-4222-8222-222222222222', outcome: 'satisfied', form_answered: 'qualified',
  granularity: 'aggregate', basis: 'declared_value', informational_use_only: true,
  commitment: { commitment_id: 'cm-1', hash: 'h'.repeat(8), signature: 's'.repeat(8), signed_at: '2026-09-16T00:00:00Z' },
};

describe('InquiryDetailPage', () => {
  it('renders the verdict outcome, form answered, and commitment id for a satisfied inquiry', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: ANSWERED })) }));
    const { default: InquiryDetailPage } = await import('../page');
    const el = await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-1' }) });
    render(el);
    expect(screen.getByText('satisfied')).toBeInTheDocument();
    expect(screen.getByText('cm-1')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  // PF P17 — the absence, with a present control in the same assertion block.
  it('never renders a Value panel, even for an answered inquiry (D-222)', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: ANSWERED })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-1' }) }));
    expect(screen.getByText('satisfied')).toBeInTheDocument();          // PRESENT CONTROL
    expect(screen.queryByText(/^Value:/)).not.toBeInTheDocument();
  });

  // PF P16 — the silent member is three keys; the answered-only fields must not be rendered at all.
  it('renders a declined inquiry without basis or granularity', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: { inquiry_id: '44444444-4444-4444-8444-444444444444', outcome: 'declined', informational_use_only: true } })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-4' }) }));
    expect(screen.getByText('declined')).toBeInTheDocument();           // PRESENT CONTROL
    expect(screen.queryByText('Basis')).not.toBeInTheDocument();
    expect(screen.queryByText('Granularity')).not.toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('renders a pending notice for { inquiry_id, status: "pending" } without treating it as an error', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: { inquiry_id: '33333333-3333-4333-8333-333333333333', status: 'pending' } })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'inq-2' }) }));
    expect(screen.getByText(/still pending/)).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  // PF P15 / Q3 — the BFF turned the upstream 403 into this body.
  it('renders the fixed not-enabled state for the BFF not_enabled body', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: { not_enabled: true } })) }));
    const { default: InquiryDetailPage } = await import('../page');
    render(await InquiryDetailPage({ params: Promise.resolve({ id: 'not-mine' }) }));
    expect(screen.getByText('Inquiry log is not enabled for this console')).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('calls notFound() on any fetch error', async () => {
    vi.resetModules();
    vi.doMock('@/lib/server-fetch', () => ({ fetchBffJson: vi.fn(async () => ({ kind: 'error', status: 502, message: 'upstream' })) }));
    const { default: InquiryDetailPage } = await import('../page');
    await expect(InquiryDetailPage({ params: Promise.resolve({ id: 'boom' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/account/sonar/inquiries/[id]/__tests__/page.test.tsx`
Expected: FAIL — `Cannot find module '../page'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/account/sonar/inquiries/[id]/page.tsx
import { notFound } from 'next/navigation';
import { isPending } from '@haiwave/protocol';
import { fetchBffJson } from '@/lib/server-fetch';
import { INQUIRY_NOT_ENABLED_MESSAGE, type InquiryDetailResponse } from '@/lib/safe-room-types';

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await fetchBffJson<InquiryDetailResponse>(`/api/account/sonar/inquiries/${id}`);
  if (result.kind === 'error') notFound();
  const inq = result.data;

  // PF P15 (Q3): the BFF's mapping of the upstream 403 — scope, not-yours and no-such-inquiry alike.
  if ('not_enabled' in inq) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-charcoal">Inquiry</h1>
        <p className="rounded-md border border-slate/15 bg-light-gray px-4 py-3 text-sm text-slate">{INQUIRY_NOT_ENABLED_MESSAGE}</p>
      </div>
    );
  }

  if (isPending(inq)) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-charcoal">Inquiry {inq.inquiry_id}</h1>
        <p className="text-sm text-slate">This inquiry is still pending a response.</p>
      </div>
    );
  }

  // PF P16: the silent member is `.strict()` with three keys — every decline is byte-equal (spec §1.4),
  // so there is nothing else to show and reading an answered-only field here would render `undefined`.
  if (!('commitment' in inq)) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-charcoal">Inquiry {inq.inquiry_id}</h1>
        <p className="text-sm text-charcoal">{inq.outcome}</p>
        <p className="text-xs text-slate">Every decline is returned in one fixed shape, so no reason is available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-charcoal">Inquiry {inq.inquiry_id}</h1>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-slate">Outcome</dt><dd className="text-charcoal">{inq.outcome}</dd></div>
        <div><dt className="text-slate">Form answered</dt><dd className="text-charcoal">{inq.form_answered}</dd></div>
        <div><dt className="text-slate">Commitment</dt><dd className="text-charcoal font-mono text-xs">{inq.commitment.commitment_id}</dd></div>
        <div><dt className="text-slate">Basis</dt><dd className="text-charcoal">{inq.basis}</dd></div>
        <div><dt className="text-slate">Granularity</dt><dd className="text-charcoal">{inq.granularity}</dd></div>
      </dl>
      {/* PF P17 — no Value panel: a re-read is ALWAYS qualified (D-222). */}
      <p className="text-xs text-slate">Re-reads are always served in qualified form: the raw value exists only in the synchronous response to the inquiry itself and is never persisted.</p>
      {inq.condition && <div className="rounded-md border border-slate/15 bg-light-gray p-4 text-sm text-charcoal">Condition: {JSON.stringify(inq.condition)}</div>}
      <div className="rounded-md border border-slate/15 bg-light-gray p-4 text-sm text-charcoal font-mono text-xs">Signed at {inq.commitment.signed_at}</div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/account/sonar/inquiries/[id]`
Expected: PASS, 6 tests. Read the reporter for `(retry x1)`/`(retry x2)` markers — a retried green is not a green. The pin check and `npm run build` run at the Batch 3 gate; the build is what checks this page against the protocol's verdict union.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/inquiries/\[id\]
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(inquiries): detail page branching the verdict union, pending and not-enabled states

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 9: Configuration pack BFF route

> **Amended:** PF P11 (the as-built body is `{ pack, figures, ceiling: { limit_per_hour, source } }` — there is no flat platform-ceiling number).

**Files:**
- Create: `src/app/api/account/query-guard/pack/route.ts`
- Test: `src/app/api/account/query-guard/pack/__tests__/route.test.ts`

**Interfaces:**
- Produces (appended to `safe-room-types.ts`): `InquiryPackConfig { pack: InquiryPackName; figures: InquiryPackFigures; ceiling: { limit_per_hour: number; source: 'participant_override' | 'platform_default' } }`. **No local pack-name union** — the protocol already exports `InquiryPackName` (the three names) and `InquiryPack` (the figures object); declaring a local type called `InquiryPack` for the *name* would collide with the protocol's meaning of that name, so the figures type is imported under the alias `InquiryPackFigures` (PF P11, PF P12).
- Consumes: `withHaiCore`, `forwardHaiCoreResponse`, `forbidNonEditor` (spec §11: "gated `forbidNonEditor` like `api/account/query-guard/rules/route.ts:21`").
- **Note the gate asymmetry:** haiCore's `PUT /query-guard/pack` carries `PARTICIPANT_WRITE` but **no** `requireRole`, so `forbidNonEditor` in this BFF is the only editor gate on the pack — load-bearing, not defence in depth. Do not weaken it.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/account/query-guard/pack/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_INQUIRY_PACKS } from '@haiwave/protocol';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, PUT } from '../route';

// PF P11 — the as-built body: the current pack, ITS figures, and the ceiling with its source.
const PACK_BODY = { pack: 'standard', figures: DEFAULT_INQUIRY_PACKS.standard, ceiling: { limit_per_hour: 50, source: 'platform_default' } };

describe('/api/account/query-guard/pack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET returns the pack, its figures and the ceiling verbatim', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(PACK_BODY) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/query-guard/pack');
    expect(await res.json()).toEqual(PACK_BODY);
  });

  it('PUT returns 403 for a non-editor role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ pack: 'open' }) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('PUT forwards the selected pack to haiCore', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ ...PACK_BODY, pack: 'open', figures: DEFAULT_INQUIRY_PACKS.open }) });
    await PUT(new NextRequest('http://x', { method: 'PUT', body: JSON.stringify({ pack: 'open' }) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/query-guard/pack', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ pack: 'open' }) }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/account/query-guard/pack`
Expected: FAIL — `Cannot find module '../route'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/account/query-guard/pack/route.ts
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../_lib/authz';

/** GET/PUT /api/account/query-guard/pack — spec §10.6. PUT body: { pack: 'guarded'|'standard'|'open' }. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/query-guard/pack')));

export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw('/query-guard/pack', { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
```

Append to `safe-room-types.ts`:

```typescript
// ─── Inquiry-door configuration packs (spec §10.6) ───
// PF P11/PF P12: both types come from the protocol. `InquiryPack` there is the FIGURES object,
// so it is aliased; the three pack names are `InquiryPackName`. Merge this into the file's single
// `@haiwave/protocol` import line rather than adding a second one (import/no-duplicates).
import type { InquiryPack as InquiryPackFigures, InquiryPackName } from '@haiwave/protocol';
export type { InquiryPackFigures, InquiryPackName };

export interface InquiryPackConfig {
  pack: InquiryPackName;
  figures: InquiryPackFigures;
  ceiling: {
    limit_per_hour: number;
    source: 'participant_override' | 'platform_default';
  };
}
```

- [ ] **Step 4: Run the test to verify it passes, then build**

Run: `npx vitest run src/app/api/account/query-guard/pack && npm run build`
Expected: PASS, 3 tests; build exits 0 (`safe-room-types.ts` is extended here). Read the reporter for `(retry x1)`/`(retry x2)` markers — a retried green is not a green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/safe-room-types.ts src/app/api/account/query-guard/pack
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(bff): inquiry-door configuration pack route

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 10: Configuration pack panel on the Query Guard page

> **Amended:** PF P11 (ceiling comes from the route's `ceiling`, not a flat number), PF P12 + ruling **Q2** (the three-pack comparison stays, but it is rendered through one typed formatter per key with **no cast** — six of the ten figures are objects, and a plain object rendered as a React child is a runtime crash that a cast hides even from `tsc`).

**Files:**
- Create: `src/app/account/settings/query-guard/_components/inquiry-pack-panel.tsx`
- Modify: `src/app/account/settings/query-guard/page.tsx`
- Test: `src/app/account/settings/query-guard/_components/__tests__/inquiry-pack-panel.test.tsx`

**Interfaces:**
- Consumes: `InquiryPackConfig`, `InquiryPackName`, `InquiryPackFigures` (Task 9), and `DEFAULT_INQUIRY_PACKS` from `@haiwave/protocol`.
- **The comparison table (Q2).** Spec §10.6 is a three-pack comparison, and the route serves figures for the **current** pack only — so the other two columns come from the protocol constant, which **is** the platform default. `DEFAULT_INQUIRY_PACKS` is already declared upstream as `Record<InquiryPackName, InquiryPack>` (`packages/protocol/src/inquiry/packs.ts:29`), so it needs no re-typing and **no cast**: each row carries a formatter that takes the whole pack and returns a string, which is what makes the six object-valued figures renderable. The current pack's column is highlighted from the route's `pack`.
- The ten figure keys and their field names are measured in the pre-flight scan (PF P12, from `packages/protocol/src/inquiry/packs.ts:13-25` and `:36-41`). If `tsc` disagrees with a formatter, the protocol is right: fix the formatter, never add a cast.

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/account/settings/query-guard/_components/__tests__/inquiry-pack-panel.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_INQUIRY_PACKS } from '@haiwave/protocol';
import { InquiryPackPanel } from '../inquiry-pack-panel';
import type { InquiryPackConfig } from '@/lib/safe-room-types';

const current: InquiryPackConfig = {
  pack: 'standard',
  figures: DEFAULT_INQUIRY_PACKS.standard,
  ceiling: { limit_per_hour: 50, source: 'platform_default' },
};

describe('InquiryPackPanel', () => {
  it('shows the current pack and the ceiling with its source', () => {
    render(<InquiryPackPanel current={current} onSave={vi.fn()} />);
    expect(screen.getByText(/Platform ceiling/)).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  // PF P12 — the assertion that would have caught six objects rendered as React children.
  it('renders every pack figure as text, object-valued ones included', () => {
    render(<InquiryPackPanel current={current} onSave={vi.fn()} />);
    expect(screen.getByText('4/hr · 8/day')).toBeInTheDocument(); // standard sku_repeat
  });

  it('calls onSave with the newly selected pack', () => {
    const onSave = vi.fn();
    render(<InquiryPackPanel current={current} onSave={onSave} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Open' }));
    expect(onSave).toHaveBeenCalledWith('open');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/account/settings/query-guard/_components/__tests__/inquiry-pack-panel.test.tsx`
Expected: FAIL — `Cannot find module '../inquiry-pack-panel'`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/account/settings/query-guard/_components/inquiry-pack-panel.tsx
'use client';

import { DEFAULT_INQUIRY_PACKS } from '@haiwave/protocol';
import type { InquiryPackConfig, InquiryPackFigures, InquiryPackName } from '@/lib/safe-room-types';

const PACKS: InquiryPackName[] = ['guarded', 'standard', 'open'];
const PACK_LABEL: Record<InquiryPackName, string> = { guarded: 'Guarded', standard: 'Standard', open: 'Open' };

/**
 * One formatter per figure. Each takes the WHOLE pack and reads its own key, so every row is
 * typed against the protocol with no cast — which is what makes the six object-valued figures
 * (sku_repeat, sku_breadth, ad_hoc_cap, volume_band, multi_subject_request, single_order_value)
 * renderable at all (PF P12).
 */
const FIGURE_ROWS: { key: keyof InquiryPackFigures; label: string; fmt: (p: InquiryPackFigures) => string }[] = [
  { key: 'sku_repeat', label: 'SKU repeat', fmt: (p) => `${p.sku_repeat.per_hour}/hr · ${p.sku_repeat.per_day}/day` },
  { key: 'operand_walk_pct', label: 'Operand walk', fmt: (p) => `${p.operand_walk_pct}%` },
  { key: 'enumeration_per_day', label: 'Enumeration', fmt: (p) => `${p.enumeration_per_day}/day` },
  { key: 'sku_breadth', label: 'SKU breadth', fmt: (p) => `${p.sku_breadth.per_hour}/hr · ${p.sku_breadth.per_day}/day` },
  { key: 'ad_hoc_cap', label: 'Ad-hoc cap', fmt: (p) => `${p.ad_hoc_cap.per_six_hours}/6h · ${p.ad_hoc_cap.per_day}/day` },
  { key: 'ad_hoc_cap_evidence_per_six_hours', label: 'Ad-hoc with evidence', fmt: (p) => `${p.ad_hoc_cap_evidence_per_six_hours}/6h` },
  { key: 'volume_band', label: 'Volume band', fmt: (p) => `${p.volume_band.low_pct}–${p.volume_band.high_pct}% → ${p.volume_band.action}` },
  { key: 'multi_subject_request', label: 'Multi-subject request', fmt: (p) => `${p.multi_subject_request.max_subjects} subjects → ${p.multi_subject_request.action}` },
  { key: 'single_order_value', label: 'Single order value', fmt: (p) => `${p.single_order_value.threshold} ${p.single_order_value.currency} → ${p.single_order_value.action}` },
  { key: 'action_at_cap', label: 'Action at cap', fmt: (p) => p.action_at_cap },
];

export function InquiryPackPanel({ current, onSave }: { current: InquiryPackConfig; onSave: (pack: InquiryPackName) => void }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-charcoal">Inquiry-door configuration pack</h2>
      <p className="mb-3 text-sm text-slate">
        Platform ceiling: <strong>{current.ceiling.limit_per_hour}</strong> inquiries / hour / responder
        {' '}({current.ceiling.source === 'participant_override' ? 'your override' : 'platform default'}).
      </p>
      <div role="radiogroup" aria-label="Configuration pack" className="flex gap-4 mb-4">
        {PACKS.map((p) => (
          <label key={p} className="flex items-center gap-2 text-sm text-charcoal">
            <input type="radio" name="inquiry-pack" role="radio" aria-checked={current.pack === p} checked={current.pack === p} onChange={() => onSave(p)} />
            {PACK_LABEL[p]}
          </label>
        ))}
      </div>
      <table className="w-full text-sm border border-slate/15 rounded-md overflow-hidden">
        <thead>
          <tr className="bg-light-gray text-charcoal text-xs font-semibold">
            <th className="p-2 text-left">Rule</th>
            {PACKS.map((p) => <th key={p} className={`p-2 text-left ${current.pack === p ? 'text-navy' : ''}`}>{PACK_LABEL[p]}{current.pack === p ? ' (current)' : ''}</th>)}
          </tr>
        </thead>
        <tbody>
          {FIGURE_ROWS.map((r) => (
            <tr key={r.key} className="border-t border-slate/10">
              <td className="p-2 text-charcoal">{r.label}</td>
              {PACKS.map((p) => (
                <td key={p} className={`p-2 ${current.pack === p ? 'text-charcoal font-medium' : 'text-slate'}`}>
                  {r.fmt(p === current.pack ? current.figures : DEFAULT_INQUIRY_PACKS[p])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

Wire into `src/app/account/settings/query-guard/page.tsx`: fetch `/api/account/query-guard/pack` in the existing `Promise.all` (`:52-58`), pass the result to a small client wrapper owning the `onSave` PUT call (the shape of `GuardRulesMatrix.save()`, `guard-rules-matrix.tsx:134-164`), and render `<InquiryPackPanel current={pack} onSave={handleSavePack} />` after Trip History (`:138-141`).

- [ ] **Step 4: Run the test to verify it passes, then build**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run src/app/api/account/query-guard src/app/account/settings/query-guard
npm run build
```
Expected: vitest PASS — read the reporter for `(retry x` markers. `npm run build` exits 0. This is the Batch 4 gate, so it covers Task 9 too.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/settings/query-guard
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(query-guard): configuration pack panel with the three-pack comparison

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 11: Registry proposals — participant BFF routes and page

> **Amended:** PF P2 (the auth mock uses the real ladder, so the POST 403 arm can fail for the right reason), PF P7 (the class list envelope), PF P8 (**the form submits three of the fifteen required keys — every proposal 400s**), PF P9 (**every key the two pages read is named differently on the wire**).

**Files:**
- Create: `src/app/api/account/attribute-classes/proposals/route.ts`
- Create: `src/app/account/attribute-classes/_components/propose-form.tsx`
- Create: `src/app/account/attribute-classes/_components/attribute-classes-client.tsx`
- Create: `src/app/account/attribute-classes/page.tsx`
- Modify: `src/components/account-nav.tsx:161-186`
- Test: `src/app/api/account/attribute-classes/proposals/__tests__/route.test.ts`
- Test: `src/app/account/attribute-classes/_components/__tests__/propose-form.test.tsx`
- Test: `src/app/account/attribute-classes/__tests__/page.test.tsx`

**Interfaces:**
- Produces (appended to `safe-room-types.ts`): `AttributeClassProposalRow` and `AttributeClassProposalListResponse`. **The row type is renamed** from the pre-amendment plan's `AttributeClassProposal`, because that name belongs to the protocol's *proposed shape* — which this row nests under `proposed_shape` (PF P9).
- Consumes: `withHaiCore`, `forwardHaiCoreResponse`, `fetchBffJson`, `AttributeClassSummary` / `AttributeClassListResponse` (Task 1), and `AttributeClassProposalSchema` + `type AttributeClassProposal` from `@haiwave/protocol`. GET lists own proposals; POST creates one, gated `{role:'account_admin'}` — a proposal persists a row immediately even though inert until adopted, treated like other participant writes (`connections/route.ts:176-189`).
- **The wire row (PF P9).** The as-built row is haiCore's route-layer `AttributeClassProposalWire` (`apps/core/src/lib/attribute-class-proposal-wire.ts:14-25`): `id`, `proposer_participant_id`, `attribute_class_id`, `proposed_shape`, `status: 'pending' | 'adopted' | 'rejected'`, `decision_reason`, `decided_by`, `decided_at`, `adopted_attribute_class_id`, `created_at`. It is **not** exported by the protocol, so it is declared in `safe-room-types.ts` verbatim with its source named in a comment. `display_name` and `value_type` live **inside** `proposed_shape`, and a fresh proposal's status is `pending`.
- **The proposal body (PF P8).** `AttributeClassProposalSchema` requires **fifteen** keys, all of them present — the nullable ones are `.nullable()`, not `.optional()`:

  | Key | Control |
  |---|---|
  | `attribute_class_id` | text; lowercase, `^[a-z][a-z0-9_]*$`, ≤64, and never one of the five reserved price slugs |
  | `display_name` | text |
  | `subject_types` | multi-select, 1..5 |
  | `value_type` | select (the ten `AttributeValueTypeSchema` values the plan already lists, measured correct) |
  | `unit` | select, nullable |
  | `operators_allowed` | multi-select, 1..11 |
  | `default_disclosure` | one cell per trust class, keyed off `TrustClassSchema.options` |
  | `granularity_ceiling` | one cell per trust class, same keying |
  | `pass_only` | checkbox |
  | `extractor` | text, `none` / `docai:<slug>` / `model:<slug>` |
  | `confidence_floor` | number 0..1, nullable |
  | `evidence_element_key` | text, nullable |
  | `evidence_document_type` | text, nullable |
  | `informational_use_only` | checkbox |
  | `attribute_class_evaluation_rule` | textarea, nullable |

  Two cross-field refinements are mirrored client-side: `unit` is required when `value_type` is `number_with_unit` or `range`, and `confidence_floor` is required unless `extractor` is `none`. Type the form's value as the protocol's `AttributeClassProposal` and let `tsc` enforce completeness rather than restating the keys in code; the layout of the fifteen controls is the implementer's.

- Design: `page.tsx` is a server component; `attribute-classes-client.tsx` is `'use client'` and owns `ProposeForm`'s submit → POST call, the same split as Task 2.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/account/attribute-classes/proposals/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { fetchRaw, getSession, getToken } = vi.hoisted(() => ({ fetchRaw: vi.fn(), getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.mock('@/lib/haiwave-api', () => ({ createHaiwaveClient: () => ({ fetchRaw }) }));
import { GET, POST } from '../route';

describe('/api/account/attribute-classes/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET lists own proposals', async () => {
    fetchRaw.mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ proposals: [] }) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/attribute-classes/proposals');
    expect(res.status).toBe(200);
  });

  it('POST returns 403 for a non-account_admin role without calling haiCore', async () => {
    getSession.mockResolvedValue({ user: { role: 'buyer_view_only' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ attribute_class_id: 'moq' }) }), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(fetchRaw).not.toHaveBeenCalled();
  });

  it('POST forwards the proposal body verbatim and returns 201', async () => {
    const body = { attribute_class_id: 'moq', display_name: 'Minimum Order Quantity' }; // a passthrough: haiCore validates the fifteen keys
    fetchRaw.mockResolvedValueOnce({ status: 201, text: async () => JSON.stringify({ proposal: { id: 'prop-1', attribute_class_id: 'moq', status: 'pending' } }) });
    const res = await POST(new NextRequest('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({}) });
    expect(fetchRaw).toHaveBeenCalledWith('/attribute-classes/proposals', expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }));
    expect(res.status).toBe(201);
  });
});
```

```tsx
// src/app/account/attribute-classes/_components/__tests__/propose-form.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttributeClassProposalSchema } from '@haiwave/protocol';
import { ProposeForm } from '../propose-form';

describe('ProposeForm', () => {
  // PF P8 — one assertion is the whole finding, and the mocked-BFF suite CAN run it.
  it('submits a value that satisfies AttributeClassProposalSchema in full', () => {
    const onSubmit = vi.fn();
    render(<ProposeForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Attribute class id'), { target: { value: 'moq' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Minimum Order Quantity' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const parsed = AttributeClassProposalSchema.safeParse(onSubmit.mock.calls[0][0]);
    expect(parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe('');
  });

  // PF P8 — the first of the two cross-field refinements, mirrored client-side.
  it('does not submit a number_with_unit proposal until a unit is chosen', () => {
    const onSubmit = vi.fn();
    render(<ProposeForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Attribute class id'), { target: { value: 'lead_time' } });
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Lead time' } });
    fireEvent.change(screen.getByLabelText('Value type'), { target: { value: 'number_with_unit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Propose' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/unit is required/i)).toBeInTheDocument();
  });
});
```

```tsx
// src/app/account/attribute-classes/__tests__/page.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// PF P7 + PF P9: the as-built envelopes and the as-built proposal row.
vi.mock('@/lib/server-fetch', () => ({
  fetchBffJson: vi.fn(async (path: string) => {
    if (path.includes('/proposals')) {
      return { kind: 'ok', data: { proposals: [{
        id: 'prop-1', proposer_participant_id: 'p-1', attribute_class_id: 'moq',
        proposed_shape: { attribute_class_id: 'moq', display_name: 'MOQ', value_type: 'integer' },
        status: 'pending', decision_reason: null, decided_by: null, decided_at: null,
        adopted_attribute_class_id: null, created_at: '2026-09-16T00:00:00Z',
      }] } };
    }
    return { kind: 'ok', data: { attribute_classes: [{ attribute_class_id: 'availability', display_name: 'Availability', status: 'adopted', default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'qualified', premier_partner: 'raw' } }] } };
  }),
}));

import AttributeClassesPage from '../page';

describe('AttributeClassesPage', () => {
  it("lists adopted classes and the participant's own proposals", async () => {
    const el = await AttributeClassesPage();
    render(el);
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText(/MOQ/)).toBeInTheDocument();
    expect(screen.getByText(/pending/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/account/attribute-classes/proposals src/app/account/attribute-classes`
Expected: FAIL — none of the modules exist.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/account/attribute-classes/proposals/route.ts
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** GET/POST /api/account/attribute-classes/proposals — spec §4.3, participant side. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/attribute-classes/proposals')));

export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = await request.text();
    return forwardHaiCoreResponse(await client.fetchRaw('/attribute-classes/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body }));
  },
  { role: 'account_admin' },
);
```

Append to `safe-room-types.ts`:

```typescript
// ─── Registry proposals (spec §4.3) ───
// PF P9: this is haiCore's ROUTE-LAYER type `AttributeClassProposalWire`
// (apps/core/src/lib/attribute-class-proposal-wire.ts:14-25). The protocol does NOT export it, so
// it is declared here verbatim; only the nested proposed shape is a protocol type. Merge this
// import into the file's single `@haiwave/protocol` import line (import/no-duplicates).
import type { AttributeClassProposal } from '@haiwave/protocol';

export interface AttributeClassProposalRow {
  id: string;
  proposer_participant_id: string;
  attribute_class_id: string;
  proposed_shape: AttributeClassProposal;
  status: 'pending' | 'adopted' | 'rejected';
  decision_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  adopted_attribute_class_id: string | null;
  created_at: string;
}

export interface AttributeClassProposalListResponse {
  proposals: AttributeClassProposalRow[];
}
```

```tsx
// src/app/account/attribute-classes/_components/propose-form.tsx
'use client';

import { useState } from 'react';
import { AttributeClassProposalSchema, TrustClassSchema, type AttributeClassProposal } from '@haiwave/protocol';
import { Button } from '@/components';

/**
 * The submitted value IS the protocol's proposal shape — all fifteen keys, because every one of
 * them is required upstream (the nullable ones are nullable, not optional). Typing the state this
 * way makes a missing key a build error instead of a 400 at runtime (PF P8).
 */
const EMPTY: AttributeClassProposal = {
  attribute_class_id: '',
  display_name: '',
  subject_types: [/* at least one InquirySubjectKind — the schema requires 1..5 */],
  value_type: 'integer',
  unit: null,
  operators_allowed: [/* at least one InquiryOperator — the schema requires 1..11 */],
  // Written out key by key, so a fifth trust class is a build error, not a missing cell.
  default_disclosure: { unknown: 'declined', behavioral_only: 'declined', trading_pair: 'declined', premier_partner: 'declined' },
  granularity_ceiling: { unknown: 'aggregate', behavioral_only: 'aggregate', trading_pair: 'aggregate', premier_partner: 'aggregate' },
  pass_only: false,
  extractor: 'none',
  confidence_floor: null,
  evidence_element_key: null,
  evidence_document_type: null,
  informational_use_only: true,
  attribute_class_evaluation_rule: null,
};
// No cast anywhere in this file: `npm run build` is the only thing in this lane that checks the
// proposal body against the protocol, and a cast is exactly what would blind it (PF P8, PF P12).
// The two empty arrays above must be given real members — the first red below fails until they are.

export function ProposeForm({ onSubmit }: { onSubmit: (value: AttributeClassProposal) => void }) {
  const [value, setValue] = useState<AttributeClassProposal>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    // Mirror the two cross-field refinements client-side so the operator sees them before the 400.
    if ((value.value_type === 'number_with_unit' || value.value_type === 'range') && value.unit === null) {
      setError('A unit is required for number_with_unit and range.');
      return;
    }
    if (value.extractor !== 'none' && value.confidence_floor === null) {
      setError('A confidence floor is required when an extractor is declared.');
      return;
    }
    const parsed = AttributeClassProposalSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Invalid proposal'); return; }
    setError(null);
    onSubmit(parsed.data);
  }

  // The fifteen controls, per the table in this task's Interfaces: seven text/enum inputs,
  // two multi-selects (subject_types, operators_allowed), two per-trust-class rows keyed off
  // TrustClassSchema.options (default_disclosure, granularity_ceiling), two checkboxes
  // (pass_only, informational_use_only), one nullable number (confidence_floor) and one textarea.
  // Every input carries the aria-label its test queries: 'Attribute class id', 'Display name',
  // 'Value type', 'Unit', … Build them here.
  return <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-3">{/* … */}<Button type="submit">Propose</Button>{error && <p className="text-sm text-problem">{error}</p>}</form>;
}
```

```tsx
// src/app/account/attribute-classes/_components/attribute-classes-client.tsx
'use client';

import { useState } from 'react';
import type { AttributeClassProposal } from '@haiwave/protocol';
import { ProposeForm } from './propose-form';
import type { AttributeClassProposalRow, AttributeClassSummary } from '@/lib/safe-room-types';

export function AttributeClassesClient({ classes, initialProposals }: { classes: AttributeClassSummary[]; initialProposals: AttributeClassProposalRow[] }) {
  const [proposals, setProposals] = useState(initialProposals);

  async function submit(value: AttributeClassProposal) {
    const res = await fetch('/api/account/attribute-classes/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
    if (!res.ok) return;
    const created = (await res.json()) as { proposal: AttributeClassProposalRow };
    setProposals((prev) => [created.proposal, ...prev]);
  }

  return (
    <>
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Adopted classes</h2><ul className="space-y-1 text-sm text-charcoal">{classes.map((c) => <li key={c.attribute_class_id}>{c.display_name}</li>)}</ul></section>
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Propose a new class</h2><ProposeForm onSubmit={submit} /></section>
      {/* PF P9: the row's id is `id`, and its display name lives inside proposed_shape. */}
      <section><h2 className="mb-3 text-lg font-semibold text-charcoal">Your proposals</h2><ul className="space-y-1 text-sm text-charcoal">{proposals.map((p) => <li key={p.id}>{p.proposed_shape.display_name} — {p.status}</li>)}</ul></section>
    </>
  );
}
```

```tsx
// src/app/account/attribute-classes/page.tsx
import { fetchBffJson } from '@/lib/server-fetch';
import { PageHeader } from '@/components';
import { AttributeClassesClient } from './_components/attribute-classes-client';
import type { AttributeClassListResponse, AttributeClassProposalListResponse } from '@/lib/safe-room-types';

export default async function AttributeClassesPage() {
  const [classesRes, proposalsRes] = await Promise.all([
    fetchBffJson<AttributeClassListResponse>('/api/account/attribute-classes'),
    fetchBffJson<AttributeClassProposalListResponse>('/api/account/attribute-classes/proposals'),
  ]);
  const classes = classesRes.kind === 'ok' ? classesRes.data.attribute_classes.filter((c) => c.status === 'adopted') : [];
  const proposals = proposalsRes.kind === 'ok' ? proposalsRes.data.proposals : [];
  return (
    <div className="space-y-8">
      <PageHeader title="Attribute Classes" description="The registry of attributes qualified inquiries can be asked about — propose a new one for platform adoption (spec §4.3)." />
      <AttributeClassesClient classes={classes} initialProposals={proposals} />
    </div>
  );
}
```

```tsx
// src/components/account-nav.tsx — Account Management (:161-186), after Disclosure Policy (Task 2)
{ href: "/account/attribute-classes", label: "Attribute Classes", tooltip: "The registry of attributes qualified inquiries can be asked about — propose new ones for platform adoption." },
```

- [ ] **Step 4: Run the tests to verify they pass, then build**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run src/app/api/account/attribute-classes src/app/account/attribute-classes
npm run build
```
Expected: vitest PASS, 6 tests; read the reporter for `(retry x` markers. `npm run build` exits 0 — it is what proves the form's value really is a complete `AttributeClassProposal`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/safe-room-types.ts src/app/api/account/attribute-classes/proposals src/app/account/attribute-classes src/components/account-nav.tsx
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(attribute-classes): participant proposal routes, registry page, full propose form

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 12 — CUT (BLOCKED on haiCore: no GET /admin/attribute-classes/proposals; owner decision)

> **CUT from this lane by ruling Q1 (PF P10).** The admin queue has **no data source**. Measured at `16b31655`, with both an in-file and a cross-file present control:
>
> ```
> $ git -C /Users/samfleming/dev/hw/haiCore-v1101-L3 grep -c "app\.get"  -- apps/core/src/routes/admin-attribute-classes.ts
>   0 hits
> $ git -C /Users/samfleming/dev/hw/haiCore-v1101-L3 grep -c "app\.post" -- apps/core/src/routes/admin-attribute-classes.ts     # PRESENT CONTROL
> apps/core/src/routes/admin-attribute-classes.ts:2
> ```
>
> The file registers exactly two routes, `/proposals/:id/adopt` and `/proposals/:id/reject`. The participant-side `GET /attribute-classes/proposals` exists but serves `listProposalsByProposer(callerId)` — the caller's own proposals only — so it cannot back an admin queue either.
>
> **Nothing in this section is dispatched and no checkbox here is ticked.** There is no Batch 6 in `## Execution order`, Task 13's route list covers no admin route, and `src/app/admin/layout.tsx` is not modified by this lane. What unblocks it is a haiCore follow-on adding `app.get('/proposals', …)` backed by a new `listAllProposals()`; that is the **owner's** decision, not L7's. Writing the BFF route now would ship a surface whose upstream 404s.
>
> The text below is kept as the starting point for that follow-on. It predates the amendment: before any of it is executed, its proposal fixtures and page reads must be re-amended per **PF P9** (the row's id is `id`, its display name lives inside `proposed_shape`, and a fresh proposal's status is `pending`, not the value this text filters on).

**Files:**
- Create: `src/app/api/admin/attribute-classes/proposals/route.ts`
- Create: `src/app/api/admin/attribute-classes/proposals/[id]/adopt/route.ts`
- Create: `src/app/api/admin/attribute-classes/proposals/[id]/reject/route.ts`
- Create: `src/app/admin/attribute-classes/page.tsx`
- Modify: `src/app/admin/layout.tsx:5-13`
- Test: `src/app/api/admin/attribute-classes/proposals/__tests__/route.test.ts`
- Test: `src/app/admin/attribute-classes/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `requireAdminToken` (`src/lib/with-hai-core.ts:21-30`), `loadEnv().HAIWAVE_API_URL`, `fetchBffJson`, `AttributeClassProposal` (Task 11). Modeled exactly on `src/app/api/admin/registration-requests/[id]/approve/route.ts:1-46` — admin routes bypass the participant-scoped client and issue their own raw `fetch` with the admin JWT.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/api/admin/attribute-classes/proposals/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { getSession, getToken } = vi.hoisted(() => ({ getSession: vi.fn(), getToken: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getSession, getToken, hasRole: (role: string, required: string) => role === required || role === 'account_owner' }));
vi.stubGlobal('fetch', vi.fn());

import { GET } from '../route';
import { POST as adopt } from '../[id]/adopt/route';
import { POST as reject } from '../[id]/reject/route';

describe('/api/admin/attribute-classes/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: true });
    getToken.mockResolvedValue('header.payload.signature');
  });

  it('GET returns 403 for a non-admin session without fetching', async () => {
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('GET lists all proposals for an admin session', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 200, json: async () => ({ proposals: [] }) });
    const res = await GET(new NextRequest('http://x'), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
  });

  it('adopt POST returns 403 for a non-admin session without fetching', async () => {
    getSession.mockResolvedValue({ user: { role: 'account_admin' }, participant: { id: 'p-1' }, is_admin: false });
    const res = await adopt(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('adopt POST forwards to haiCore and returns the upstream status', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 200, json: async () => ({ proposal_id: 'prop-1', status: 'adopted' }) });
    const res = await adopt(new NextRequest('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(200);
  });

  it('reject POST forwards a reason and returns the upstream status', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ status: 200, json: async () => ({ proposal_id: 'prop-1', status: 'rejected' }) });
    const res = await reject(new NextRequest('http://x', { method: 'POST', body: JSON.stringify({ reason: 'duplicate of availability' }) }), { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(200);
  });
});
```

```typescript
// src/app/admin/attribute-classes/__tests__/page.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/server-fetch', () => ({
  fetchBffJson: vi.fn(async () => ({ kind: 'ok', data: { proposals: [{ proposal_id: 'prop-1', attribute_class_id: 'moq', display_name: 'MOQ', value_type: 'integer', status: 'proposed', proposed_by_participant_id: 'p-1', proposed_at: '2026-09-16T00:00:00Z', decided_at: null, decision_reason: null }] } })),
}));

import AdminAttributeClassesPage from '../page';

describe('AdminAttributeClassesPage', () => {
  it('lists pending proposals with Adopt/Reject actions', async () => {
    const el = await AdminAttributeClassesPage();
    render(el);
    expect(screen.getByText('MOQ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adopt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/admin/attribute-classes src/app/admin/attribute-classes`
Expected: FAIL — none of the modules exist.

- [ ] **Step 3: Write the implementations**

```typescript
// src/app/api/admin/attribute-classes/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminToken } from '@/lib/with-hai-core';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

export async function GET(_request: NextRequest, { params }: { params: Promise<Record<string, never>> }) {
  await params;
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  try {
    const res = await fetch(`${API_URL}/api/v1/admin/attribute-classes/proposals`, { headers: { Authorization: `Bearer ${gate.token}`, 'X-HaiWave-Protocol-Version': PROTOCOL_VERSION } });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
```

```typescript
// src/app/api/admin/attribute-classes/proposals/[id]/adopt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  try {
    const res = await fetch(`${API_URL}/api/v1/admin/attribute-classes/proposals/${encodeURIComponent(id)}/adopt`, {
      method: 'POST', headers: { Authorization: `Bearer ${gate.token}`, 'Content-Type': 'application/json', 'X-HaiWave-Protocol-Version': PROTOCOL_VERSION }, body: await request.text(),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
```

```typescript
// src/app/api/admin/attribute-classes/proposals/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PROTOCOL_VERSION } from '@haiwave/protocol';
import { requireAdminToken } from '@/lib/with-hai-core';
import { loadEnv } from '@/config/env';

const API_URL = loadEnv().HAIWAVE_API_URL;

/** Body: { reason?: string }. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  try {
    const res = await fetch(`${API_URL}/api/v1/admin/attribute-classes/proposals/${encodeURIComponent(id)}/reject`, {
      method: 'POST', headers: { Authorization: `Bearer ${gate.token}`, 'Content-Type': 'application/json', 'X-HaiWave-Protocol-Version': PROTOCOL_VERSION }, body: await request.text(),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to reach haiCore' }, { status: 502 });
  }
}
```

```tsx
// src/app/admin/attribute-classes/page.tsx
import { fetchBffJson } from '@/lib/server-fetch';
import type { AttributeClassProposal } from '@/lib/safe-room-types';

export default async function AdminAttributeClassesPage() {
  const result = await fetchBffJson<{ proposals: AttributeClassProposal[] }>('/api/admin/attribute-classes/proposals');
  const proposals = result.kind === 'ok' ? result.data.proposals.filter((p) => p.status === 'proposed') : [];
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-charcoal">Attribute Class Proposals</h1>
      {result.kind === 'error' && <div role="alert" className="rounded-md border border-problem/30 bg-problem/10 px-4 py-3 text-sm text-problem">{result.message}</div>}
      <ul className="space-y-3">
        {proposals.map((p) => (
          <li key={p.proposal_id} className="border border-slate/15 rounded-md p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-charcoal">{p.display_name}</p>
              <p className="text-xs text-slate">{p.attribute_class_id} · {p.value_type} · proposed by {p.proposed_by_participant_id}</p>
            </div>
            <div className="flex gap-2">
              <form action={`/api/admin/attribute-classes/proposals/${p.proposal_id}/adopt`} method="post"><button type="submit" className="text-xs bg-teal text-white px-3 py-1.5 rounded font-medium">Adopt</button></form>
              <form action={`/api/admin/attribute-classes/proposals/${p.proposal_id}/reject`} method="post"><button type="submit" className="text-xs bg-problem/10 text-problem px-3 py-1.5 rounded font-medium">Reject</button></form>
            </div>
          </li>
        ))}
        {proposals.length === 0 && <p className="text-sm text-slate">No pending proposals.</p>}
      </ul>
    </div>
  );
}
```

Add to `src/app/admin/layout.tsx:5-13`'s nav array, after "Participants": `{ href: "/admin/attribute-classes", label: "Attribute Classes" },`

- [ ] **Step 4: Run the tests to verify they pass, then build**

Run: `npx vitest run src/app/api/admin/attribute-classes src/app/admin/attribute-classes && npm run build`
Expected: vitest PASS, 6 tests; build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/attribute-classes src/app/admin/attribute-classes src/app/admin/layout.tsx
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
feat(admin): attribute-class proposal list/adopt/reject routes and page

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Task 13: D-211 ratchet — consolidated role-gate test and full-suite verification

> **Amended:** PF P1 (**the eight route entries resolved outside `account/`, so all sixteen cases threw on module resolution** — one `..`, as the precedent uses), PF P28 + ruling Q6 (the admit arm also asserts that the handler reached haiCore), Q1 (no admin routes: Task 12 is cut).

**Files:**
- Create: `src/app/api/account/__tests__/role-gate-safe-room-routes.test.ts`

**Interfaces:**
- Consumes: `RouteSpec`, `requestFor`, `sessionFor`, `clientDouble` (`src/test/role-gate.ts`) — the idiom of `role-gate-obligations-audit.test.ts:26-61`, extended to every mutation route Tasks 1–12 added.
- No new production code — verification that each task's individual gate also satisfies the ratchet as a set.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/account/__tests__/role-gate-safe-room-routes.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserRole } from '@/lib/auth';
import { requestFor, type RouteSpec } from '@/test/role-gate';

const state = vi.hoisted(() => ({ role: 'buyer_view_only' as string, calls: [] as string[] }));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  const { sessionFor } = await import('@/test/role-gate');
  return { ...actual, getSession: vi.fn(async () => sessionFor(state.role as UserRole)), getToken: vi.fn(async () => 'header.payload.signature') };
});
vi.mock('@/lib/haiwave-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/haiwave-api')>('@/lib/haiwave-api');
  const { clientDouble } = await import('@/test/role-gate');
  return { ...actual, createHaiwaveClient: vi.fn(() => clientDouble(state.calls)) };
});

// v1.101 safe-room mutation routes (Tasks 1, 3, 4, 9, 11).
// PF P1: this file lives in src/app/api/account/__tests__/, so ONE `..` reaches
// src/app/api/account — the precedent at role-gate-obligations-audit.test.ts:27 uses one.
// Task 12's admin routes are CUT from this lane (ruling Q1), so nothing here covers
// src/app/api/admin; they would in any case authorize via requireAdminToken rather than
// withHaiCore, and clientDouble's generic {} cannot stand in for their raw-fetch shape.
const ROUTES: RouteSpec[] = [
  { name: 'disclosure-policy', load: () => import('../disclosure-policy/route'), methods: ['PUT'] },
  { name: 'disclosure-policy/overrides/[counterpartyId]', load: () => import('../disclosure-policy/overrides/[counterpartyId]/route'), methods: ['PUT'], params: { counterpartyId: '11111111-1111-4111-8111-111111111111' } },
  { name: 'room-participation', load: () => import('../room-participation/route'), methods: ['PUT'] },
  { name: 'connections/[id]/premier', load: () => import('../connections/[id]/premier/route'), methods: ['PUT'], params: { id: 'conn-1' } },
  { name: 'connections/[id]/activate', load: () => import('../connections/[id]/activate/route'), methods: ['POST'], params: { id: 'conn-1' } },
  { name: 'connections/[id]/decline-activation', load: () => import('../connections/[id]/decline-activation/route'), methods: ['POST'], params: { id: 'conn-1' } },
  { name: 'query-guard/pack', load: () => import('../query-guard/pack/route'), methods: ['PUT'] },
  { name: 'attribute-classes/proposals', load: () => import('../attribute-classes/proposals/route'), methods: ['POST'] },
];

beforeEach(() => { state.calls.length = 0; });

describe('v1.101 safe-room BFF mutations are role-gated (D-211)', () => {
  for (const route of ROUTES) {
    for (const method of route.methods) {
      it(`${method} ${route.name} refuses buyer_view_only with 403 before calling haiCore`, async () => {
        state.role = 'buyer_view_only';
        const mod = await route.load();
        const handler = mod[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
        const res = await handler(requestFor(method), { params: Promise.resolve(route.params ?? {}) });
        expect(res.status).toBe(403);
        expect(state.calls).toEqual([]);
      });
      it(`${method} ${route.name} admits account_admin and reaches haiCore`, async () => {
        state.role = 'account_admin';
        const mod = await route.load();
        const handler = mod[method] as (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;
        const res = await handler(requestFor(method), { params: Promise.resolve(route.params ?? {}) });
        expect(res.status).not.toBe(403);
        expect(res.status).not.toBe(401);
        // PF P28 (ruling Q6): clientDouble resolves {} for every method, so a route that crashes on
        // the upstream response also returns a non-403, non-401 500 — the status alone cannot tell
        // "the gate admitted" from "the handler blew up". Asserting the upstream call can.
        expect(state.calls).toContain('fetchRaw');
      });
    }
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/api/account/__tests__/role-gate-safe-room-routes.test.ts`
Expected: **PASS** — every route was TDD'd with its own 403 test, and this step exists to catch a regression introduced between tasks. A **module-resolution error here means a wrong `..` depth, not a missing gate** (PF P1: the precedent at `role-gate-obligations-audit.test.ts:27` uses one `..`). If a gate is genuinely missing, proceed to Step 3; otherwise go to Step 4. Read the reporter for `(retry x` markers either way.

- [ ] **Step 3: Fix any gap found**

The fix is always in that route's own file (add the missing `role:`/`forbidNonEditor(`/`requireAdmin` gate), never in this test file, which only observes.

- [ ] **Step 4: Run the full verification sweep**

Run:
```bash
/usr/bin/grep '"version"' node_modules/@haiwave/protocol/package.json
readlink node_modules/@haiwave/protocol
npx vitest run
npm run build
```
Expected: every suite PASS, including `src/__tests__/bff-mutations-are-role-gated.test.ts` (the repo-wide ratchet, unmodified by this plan — the pre-flight measured all ten mutation routes as satisfying it by construction) and the new `role-gate-safe-room-routes.test.ts`; read the reporter output for `(retry x1)`/`(retry x2)` markers and re-run individually if found — a retried green is not a green. `npm run build` exits 0. `src/app/api/account/__tests__/role-gate-obligations-audit.test.ts` is **not** edited by this lane (ruling Q6: its admit arm has the same inherited shape, and tightening it is a house item on the owner's list). After this batch comes the COMBINED gate in `## Execution order`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/account/__tests__/role-gate-safe-room-routes.test.ts
cat > .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt <<'MSG'
test(bff): consolidated D-211 role-gate coverage for v1.101 safe-room routes

Co-Authored-By: <the model that actually authored this commit> <noreply@anthropic.com>
MSG
git commit -F .superpowers/sdd/2026-09-18-v1101-L7-console/commit-msg.txt
```

---

## Self-Review

**1. Spec §11 coverage** — Disclosure policy → Tasks 1–2; Premier designation → 3, 5; Trading pair activation (D-146) → 4–5; Inquiry log → 6–8; Configuration packs → 9–10; Registry proposals → **11 only** (the admin half, Task 12, is CUT — Q1); D-211 ratchet → 13, plus each task's own 403 test; shared tab accessibility → Task 0. Vocabulary is a Global Constraint, not a task, since it prohibits an action rather than requiring one. No console ask composer (P8 — the spec's own ruling id) confirmed.

**2. Placeholder scan** — no "TBD"/"similar to Task N"/unfilled steps. Two places deliberately leave layout to the implementer and say so: Task 11's fifteen-control form (the keys, their controls and both refinements are specified; the JSX is not) and Task 10's wiring of the panel into the existing Query Guard page. Every server-component page needing client-side interactivity (Tasks 2, 7, 11) is written from the start as a correct server-page-plus-client-wrapper split.

**3. Type consistency** — `safe-room-types.ts` is the single source for every shared shape **that the protocol does not already own**: `DisclosurePolicyRow` / `DisclosurePolicyResponse` / `DisclosurePolicyOverrideRow` / `RoomParticipationState` / `RoomParticipationSetting` / `AttributeClassSummary` / `AttributeClassListResponse` (Task 1, reused in 2 and 11), `InquiryLogRow` / `InquiryListResponse` / `InquiryNotEnabled` / `InquiryDetailResponse` (Task 6, consumed by 7–8), `InquiryPackConfig` (Task 9, consumed by 10), `AttributeClassProposalRow` / `AttributeClassProposalListResponse` (Task 11). What it does **not** re-declare, by amendment: the verdict union and `isPending` (PF P16, PF P18), the pack figures and pack names (PF P11, PF P12), and the attribute-class row, which `AttributeClassSummary` derives from with `Pick` (PF P7). `MockPartner`'s two new fields (`trust_class?`, `pending_activation_at?`, Task 5) are optional everywhere read — which is both what keeps `MOCK_PARTNERS`'s six-entry literal compiling and the honest typing while haiCore does not project them (PF P13). `forwardHaiCoreResponse` (Task 1) is imported with an identical signature by every later route file.

**4. What this plan does NOT close.** Four items are outside the lane and belong to the owner, each stated at its task: the haiCore projection of `trust_class` and `pending_activation_at` (Task 5 ships with two inert arms); a haiCore admin list route for proposals (Task 12 is cut); the `inquiry:ask` grant to the portal Keycloak client (Tasks 6–8 ship behind one fixed not-enabled state); and the deployed value of `PROTOCOL_STRICT_VALIDATION` (this plan sends no undeclared key either way). None of them blocks a batch, and none is a defect in this code.

**5. What the tests cannot catch.** Every BFF test mocks the upstream client and every page test mocks `server-fetch`, and vitest never typechecks — so **no wire-shape error in this lane is reachable by its own tests**. `npm run build` is the only automated defence, which is why it joins every batch gate, and why no cast is tolerated anywhere near a protocol type: a cast defeats the one check that works.
