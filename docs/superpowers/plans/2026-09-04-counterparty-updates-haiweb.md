# Counterparty Updates — HaiWeb lane (v1.86) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The console's half of "Counterparty updates": a **Counterparty updates** tab on the Manifests page (rows grouped by counterparty; your ERP value · represented value · their last updated · keep mine / take theirs; identity rows with a candidate select + Link; the write-not-allowed alert and dirty pills; **Sync all now** with last check-in and next slot), the BFF routes and client methods behind it, and a **Locations** editor on the Company Profile page (headquarters + child plants).

**Architecture:** One new tab component directory under the Manifests page, three BFF routes under `src/app/api/account/counterparty-updates/`, three client methods on `HaiwaveClient`. The rows table follows the data-cleansing review queue (`DataTable` + inline `Button`s + optimistic update + toast); Sync all now follows the Sonar run-now button with SWR polling. The profile's existing address block becomes the headquarters location; a plants list editor joins it; the PUT sends explicit haiCore field names plus `locations[]`. Types are local mirrors of the 3.82.0 wire shapes (the console mirrors haiCore shapes locally today); no protocol import is needed for this feature.

**Tech Stack:** Next.js (App Router, BFF routes), React, SWR / `useApi`, Tailwind, Vitest + Testing Library, Playwright (`e2e/` typecheck via `npx playwright test --list`).

**Spec:** `docs/superpowers/specs/2026-09-04-counterparty-attribute-ownership-and-updates-design.md` (byte-identical copy of haiCore's canonical spec). Wire shapes: haiCore's plan `haiCore-cpsync/docs/superpowers/plans/2026-09-04-counterparty-updates-haicore.md` Task 1 and Task 7's route table. Plan A's header (review round 1) records eight stated deviations from the spec; this plan follows them — in particular the decision body is `{ keep: 'mine' | 'theirs' } | { link: number }` (Plan A's `CounterpartyUpdateDecisionSchema` is the source of truth; the spec's `'<erp_ref>'` was illustrative), and no location-UPDATE verb ships this cycle (a matched location on take-theirs answers `not_permitted` and shows as dirty until the manual edit converges — the same alert path).

## Global Constraints

- Worktree `~/dev/hw/haiWeb-cpsync`, branch `v1.86-counterparty-updates`, base `de85db2` (origin/master). Never touch `~/dev/hw/haiWeb` (the :3001 console's tree) or `~/dev/hw/haiCore` (the live Central's tree).
- Release: HaiWeb **v1.86** cycle (release PR `v1.86`); no package.json bump (HaiWeb releases follow the cycle label). Merge order: after haiCore v1.86.0 and haiClient 1.89.0.
- `@haiwave/protocol` resolves via `file:../haiCore/packages/protocol` — i.e. the PRIMARY haiCore checkout. This lane never repoints or symlinks it to an unmerged tree; the gate runs against whatever the primary carries (this feature imports nothing new from the protocol). Central accepts an older minor protocol header.
- **No commercial ERP name in any user-visible string** — "your ERP" throughout.
- Every string the spec quotes is used verbatim: the alert *"Write not allowed — your agent is not permitted to update your ERP. Please update these records directly in your ERP; they will clear on the next refresh."*; the tab label **"Counterparty updates"**; the existing tab keeps its label **"Counterparty Manifest"** (owner ruling #2, 2026-09-05 — no rename).
- Tests: `~/dev/hw/vitest-lock.sh npx vitest run <file> --maxWorkers=3 --minWorkers=1` (one vitest on the machine at a time). Gate at HOLD: `npm run build` (0) · `vitest run` (0 failed) · `npx playwright test --list` (0 type errors).
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never push (owner's word in session hw-a3's window).

## File structure (the decomposition)

| file | responsibility |
|---|---|
| `src/lib/counterparty-updates-types.ts` (new) | local mirrors of the wire rows, sync state, decision, list response |
| `src/lib/haiwave-api.ts` | `listCounterpartyUpdates`, `decideCounterpartyUpdate`, `syncCounterpartyUpdatesNow` (+ interface entries beside `entityApprovalsQueue` :502) |
| `src/app/api/account/counterparty-updates/{route.ts, [id]/decide/route.ts, sync-now/route.ts}` (new) | BFF, `role: "account_admin"` on all three |
| `src/app/account/manifests/counterparty-updates/{counterparty-updates-tab.tsx, updates-table.tsx, write-alert.tsx, sync-now-panel.tsx}` (new) | the tab |
| `src/app/account/manifests/page.tsx` | tab registration; "Counterparty Manifest" keeps its label (no rename) |
| `src/app/account/profile/profile-form.tsx`, `src/lib/haiwave-api.ts` (`ParticipantProfile.locations`) | the Locations editor + explicit PUT mapping |

---

### Task 1: Types, client methods, BFF routes

**Files:**
- Create: `src/lib/counterparty-updates-types.ts`
- Modify: `src/lib/haiwave-api.ts` (interface ~:502 area; implementation beside `entityApprovalsQueue` ~:1115)
- Create: `src/app/api/account/counterparty-updates/route.ts`, `src/app/api/account/counterparty-updates/[id]/decide/route.ts`, `src/app/api/account/counterparty-updates/sync-now/route.ts`
- Test: `src/app/api/account/counterparty-updates/__tests__/routes.test.ts` (the `profile/__tests__/route.test.ts` idiom: `vi.mock('@/lib/auth')`, `vi.mock('@/lib/haiwave-api')`)

**Interfaces (produces):**
```ts
// counterparty-updates-types.ts (mirrors protocol 3.82.0 — keep field names identical)
export type CounterpartySide = 'customer' | 'vendor';
export type CounterpartyUpdateKind = 'identity' | 'attribute' | 'location';
export type CounterpartyUpdateStatus = 'pending' | 'approved' | 'applied' | 'kept' | 'converged' | 'archived';
export interface CounterpartyUpdateCandidate { erp_ref: number; erp_id: string; name: string; city?: string | null; state?: string | null; score: number; matched_on: 'name_exact' | 'name_concat' | 'name' }
// a location row's ambiguous candidates (Plan A's CounterpartyLocationCandidateSchema, header item 8) — identity rows carry the shape above
export interface CounterpartyLocationCandidate { location_ref: string; name: string; city?: string | null; state?: string | null; postal_code?: string | null }
export interface CounterpartyUpdateRow {
  id: string; counterparty_participant_id: string; counterparty_name: string; side: CounterpartySide; kind: CounterpartyUpdateKind;
  attribute_key: string; source: 'profile' | 'locations' | 'library' | 'manifest' | 'erp'; label: string;
  mine: unknown; theirs: unknown; theirs_updated_at: string | null; candidates?: Array<CounterpartyUpdateCandidate | CounterpartyLocationCandidate>;   // identity rows: the former; location rows: the latter (narrow on 'erp_ref' in)
  observed_at: string; status: CounterpartyUpdateStatus; decision: 'take_theirs' | 'keep_mine' | 'link' | null; decision_ref: string | null;
  decided_by: string | null; decided_at: string | null; dirty: boolean; applied_at: string | null; apply_detail: string | null;
}
export interface WriteCapabilities { customer_fields: boolean; vendor_fields: boolean; customer_ship_to: boolean; vendor_purchase_point: boolean }
export interface CounterpartySyncState { slot_utc: string; last_checkin_at: string | null; last_run_id: string | null; last_run_status: string | null; write_capabilities: WriteCapabilities | null; agent_version: string | null; in_flight_since: string | null }
export interface CounterpartyUpdatesList { rows: CounterpartyUpdateRow[]; sync_state: CounterpartySyncState | null; counterparties: Array<{ participant_id: string; name: string; pending_count: number }> }
// decision body mirrors Plan A's CounterpartyUpdateDecisionSchema (haiCore-cpsync/docs/superpowers/plans/2026-09-04-counterparty-updates-haicore.md:320-324) — that schema is the source of truth, not the spec's illustrative '<erp_ref>' string
export type CounterpartyUpdateDecision = { keep: 'mine' | 'theirs' } | { link: number };
export interface SyncNowResponse { status: 'started' | 'already_running' | 'no_endpoint' | 'agent_unreachable'; run_id?: string }
// HaiwaveClient
listCounterpartyUpdates(query: { status?: 'pending' | 'decided' | 'all'; counterparty?: string }): Promise<CounterpartyUpdatesList>;   // GET /counterparty-updates?…
decideCounterpartyUpdate(id: string, decision: CounterpartyUpdateDecision): Promise<CounterpartyUpdateRow>;                       // POST /counterparty-updates/:id/decide
syncCounterpartyUpdatesNow(): Promise<SyncNowResponse>;                                                                          // POST /counterparty-updates/sync-now
// BFF: GET /api/account/counterparty-updates?status=&counterparty= · POST /api/account/counterparty-updates/:id/decide · POST /api/account/counterparty-updates/sync-now — all { role: "account_admin" }, no fallback (a 4xx from haiCore passes through verbatim, the with-hai-core rule)
```

- [ ] **Step 1: Write the failing route tests**
```ts
// GET forwards status/counterparty to client.listCounterpartyUpdates and returns its JSON; a non-admin session is 403 (hasRole mocked false) and the client is never called (present control: the admin case calls it once).
// POST decide validates the body shape locally ({ keep: 'mine' | 'theirs' } | { link: number }; anything else 400 without calling haiCore) and forwards { link: 7 } verbatim; a haiCore 409 comes back as 409 with its body.
// POST sync-now calls client.syncCounterpartyUpdatesNow and returns { status, run_id? }.
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** Client methods in the `entityApprovalsQueue` idiom (`URLSearchParams` for the two query keys; `request<T>('POST', …, body)`). Routes with `withHaiCore(handler, { role: "account_admin" })`; decide validates with a local zod schema `z.union([z.object({ keep: z.enum(['mine','theirs']) }).strict(), z.object({ link: z.number().int() }).strict()])` and answers `NextResponse.json({ error: 'Invalid decision' }, { status: 400 })` on failure. No `fallback` on any of the three routes — the profile PUT route (`src/app/api/account/profile/route.ts:24-27`) documents why: a non-JWT token must 401, never echo.

- [ ] **Step 4: Run — expect PASS. `npm run build`.**

- [ ] **Step 5: Commit**

```bash
git add src/lib/counterparty-updates-types.ts src/lib/haiwave-api.ts src/app/api/account/counterparty-updates
git commit -m "feat(bff): counterparty-updates — types, client methods, list/decide/sync-now routes (account_admin)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The "Counterparty updates" tab

**Files:**
- Create: `src/app/account/manifests/counterparty-updates/counterparty-updates-tab.tsx`, `updates-table.tsx`, `write-alert.tsx`, `sync-now-panel.tsx`
- Modify: `src/app/account/manifests/page.tsx:13-20, :35-41` (tab + rename)
- Test: `src/app/account/manifests/__tests__/page-tabs.test.tsx` (seven tabs; "Counterparty Manifest" present; "Counterparty updates" after "Entity Approvals"), `src/app/account/manifests/counterparty-updates/__tests__/counterparty-updates-tab.test.tsx`

**Interfaces:**
- Consumes: Task 1's client via `fetch('/api/account/counterparty-updates…')` (the `useApi` / `fetch` idiom of `review-queue-panel.tsx`); `DataTable`/`Column`, `Button`, `Card`, `Pill`, `useToast`.
- Produces: `<CounterpartyUpdatesTab />` (default export used by `page.tsx`); `<UpdatesTable rows counterparties onDecide />`; `<WriteAlert state rows />`; `<SyncNowPanel state onStarted />`.

Layout (spec §6.4): header row — **Sync all now** (disabled while `sync_state.in_flight_since` is set or a click is pending; after `started` the list re-fetches every `SYNC_NOW_POLL.intervalMs` (10 s) until `last_run_id` changes or `SYNC_NOW_POLL.maxTicks` (30, i.e. 5 minutes) pass; `already_running` shows "A sync is already running"; `no_endpoint` shows "Your agent has not registered an endpoint yet"; `agent_unreachable` shows "Your agent could not be reached") · "Last check-in <relative> · next scheduled <slot_utc> UTC" · the filter (`pending` default / `decided` / `all`) and a counterparty select built from `counterparties[]`. Then **`<WriteAlert>`** (role="alert") only when `sync_state.write_capabilities` is non-null and every flag is false while an `approved` row exists — the write is not enabled at all (ruling 3's case; the verbatim sentence). A row that is `approved && dirty` shows its own `apply_detail` in the Why column instead: a dirty row is not evidence the agent lacks write permission, and after the four-verb decision it routinely is not (a matched location's take-theirs is refused with its own sentence while other writes succeed). `sync_state` / `write_capabilities` are null until the first check-in — the alert fires only when non-null and every flag false while an `approved` row exists; pin the null case as a present control. Then the table, grouped by counterparty (a group header per `counterparty_name` with its pending count), columns: attribute (`label`, with a `source` pill) · **Your ERP value** · **Represented value** · **Their last updated** (relative + absolute title; "—" when null) · status pill (`pending` · `approved — awaiting your agent` · `dirty — apply in your ERP` · `applied` · `kept` · `converged`) · **Why** — `apply_detail` when non-null (the agent's own sentence for this row: a refused write, a failed apply, or the location-update refusal), rendered as the row's own text and never as the banner · actions: `pending` attribute/location rows → **Keep mine** / **Take theirs** (a location row with `mine === null` reads "Not in your ERP" and its button says **Create in ERP**; `candidates` on a location row means "matched ambiguously" and lists each candidate as `name · location_ref · city, state` with no Take theirs — a location candidate is `{ location_ref, name, city?, state?, postal_code? }`, not the identity shape; its **Keep mine** suppresses that represented address until it changes (central records `decided_theirs_hash`), the only outcome available for such a row this cycle, and a caption on the row says so); `pending` identity rows → a `<select>` of candidates (`name · erp_id · city, state`) + **Link**, or "No candidate records" when empty. A decision POSTs, optimistically replaces the row from the response, toasts `Kept your value` / `Approved — your agent will apply it` / `Linked`, and reverts with a toast on a non-2xx. Values render: strings as text; numbers with locale grouping; `{ amount_usd }` as `$5,000,000`; booleans as Yes/No; an address tuple `{ lines[], city, state, postal_code, country }` as two lines; anything else as JSON in `<code>`.

- [ ] **Step 1: Write the failing tests**
```ts
// page-tabs: seven tab buttons; 'Counterparty Manifest' present; 'Counterparty updates' after 'Entity Approvals'; clicking it renders the header "Sync all now".
// tab (fetch stubbed per URL): renders a group per counterparty with the pending count; a row shows label, your value, represented value, "2 days ago"-style last updated; Keep mine POSTs { keep: 'mine' } and the row becomes kept without a refetch (fetch called exactly twice: list + decide); Take theirs POSTs { keep: 'theirs' }; a location row with mine null shows "Not in your ERP" and "Create in ERP"; an ambiguously matched location row lists each candidate as name · location_ref · city, state and offers no Take theirs (present control: the same row still offers Keep mine, captioned as suppressing that represented address until it changes); an identity row's Link POSTs { link: 7 } for the selected candidate; the alert appears when all write capabilities are false and an approved row exists and reads the verbatim sentence (present control: absent when capabilities are true); an `approved && dirty` location row whose `apply_detail` reads "your agent may create a location in your ERP but not change an existing one …" renders that sentence in its own Why cell and does NOT render the generic banner (present control: an `approved && dirty` row while `write_capabilities` are all false renders both); the alert is also absent when `sync_state` is null and an approved row exists (present control for the pre-first-check-in state); Sync all now POSTs sync-now, shows "Sync started", disables itself, and re-fetches until last_run_id changes (fake timers); filter changes the query string; a 409 on decide reverts the row and toasts.
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** the four components and the page change:
```ts
const MANIFEST_TABS = [
  { key: "counterparty", label: "Counterparty Manifest" },
  { key: "library_sharing", label: "Library — Sharing" },
  { key: "library_requirements", label: "Library — Requirements" },
  { key: "pricing", label: "Baseline Pricing" },
  { key: "sharing", label: "Audit Permissions" },
  { key: "entity_approvals", label: "Entity Approvals" },
  { key: "counterparty_updates", label: "Counterparty updates" },
];
// … {activeTab === "counterparty_updates" && <CounterpartyUpdatesTab />}
```
`sync-now-panel.tsx` composes its own button (the run-now button navigates to a run page; this one stays on the tab), with the busy/disabled and `role="alert"` error idioms copied from `run-now-button.tsx`. Polling: a single named constant `const SYNC_NOW_POLL = { intervalMs: 10_000, maxTicks: 30 } as const;` (10 s × 30 ticks = 5 minutes, used by both the prose above and the code so the two figures cannot drift) backs a `useEffect` with `setInterval(refetch, SYNC_NOW_POLL.intervalMs)` while `awaitingRunId` is set, cleared on change or after `SYNC_NOW_POLL.maxTicks` ticks.

- [ ] **Step 4: Run — expect PASS. `npm run build`.**

- [ ] **Step 5: Commit**

```bash
git add src/app/account/manifests
git commit -m "feat(console): Counterparty updates tab — grouped rows, keep/take/link, write alert, Sync all now

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Locations on the Company Profile — headquarters + plants, explicit PUT mapping

**Files:**
- Modify: `src/lib/haiwave-api.ts` (`ParticipantProfile` gains `locations?: ProfileLocation[]`; export `ProfileLocation`)
- Modify: `src/app/account/profile/profile-form.tsx` (`ProfileData` :11-27; load ~:58-80; submit :150-175; the address block; a new "Plant locations" section)
- Test: `src/app/account/profile/__tests__/profile-form-locations.test.tsx` (the directory does not exist yet — measured; create it, making this file the first test in it, following the `page-tabs.test.tsx` render idiom with `fetch` stubbed)

**Interfaces (produces):**
```ts
export interface ProfileLocation { id?: string; kind: 'headquarters' | 'plant'; label: string; address_line1?: string | null; address_line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null; updated_at?: string }
// PUT /api/account/profile body (explicit haiCore field names — the form's own keys are no longer sent):
// { legal_name, dba_name, website_url, vendor_description, primary_contact_name, primary_contact_email, primary_contact_phone,
//   business_address_city, business_address_state, business_address_country,   // mirrored from the headquarters location
//   locations: [ { kind: 'headquarters', … }, ...plants ] }
```

Today the form sends its own keys (`company_name`, `address`, `phone`, …) and haiCore ignores them (measured: `RegistrationService.updateProfile` maps only its known snake_case fields) — so address edits never persisted. This task maps every field the form already has explicitly; fields haiCore has no column for stay client-side (a §L note in the PR body). The load side is broken too, more severely: sending haiCore's real field names on Save without first fixing what the form loads on GET would silently wipe `legal_name` and five other columns on the very first Save (see the new Step 3 below).

- [ ] **Step 1: Write the failing test**
```ts
// renders the headquarters block from profile.locations[kind=headquarters] (address_line1 → the line1 input) and one "Plant locations" card per plant;
// "Add plant" appends an empty plant row (label required); "Remove" drops it;
// Save PUTs a body with legal_name (from the company name input), business_address_city mirrored from HQ, and locations with EXACTLY one headquarters followed by the plants (assert the parsed body);
// a profile with no locations renders an empty HQ block and no plants (present control) and Save still sends one headquarters.
// THE ROUND-TRIP PIN (this is the red that catches the load/save defect): fetch stub answers haiCore's REAL shape —
// { participant_id: 'P1', legal_name: 'Acme Corporation', business_type: 'Corporation', website_url: 'https://acme.example',
//   primary_contact_email: 'ap@acme.example', locations: [{ id: 'L1', kind: 'headquarters', label: 'Headquarters', address_line1: '1 Main St', city: 'Akron' }] }
// render; click Save with NO edits; assert body.legal_name === 'Acme Corporation' (never '' — the load must have mapped it),
// body.website_url === 'https://acme.example' (present control: an untouched field survives), body.locations has length 1.
// A SECOND case: the fetch stub answers the mock/dev-shim shape instead ({ company_name: 'Apex Manufacturing', address: {...}, phone, email, website, description })
// and the company-name input still renders "Apex Manufacturing" (present control that the dev shim keeps working).
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Fix the LOAD first, in the same task.** haiCore's real profile body (measured: `buildProfile` in `haiCore-cpsync/apps/core/src/services/company-search.ts:387-407`) emits `participant_id, legal_name, dba_name, vendor_description, business_type, locality{city,state,country}, website_url, primary_contact_email, primary_contact_phone, primary_contact_name, registered_at, total_registered_products, categories`. Map that body into `ProfileData` on arrival: `company_name ← legal_name`, `dba ← dba_name`, `website ← website_url`, `description ← vendor_description`, `email ← primary_contact_email`, `phone ← primary_contact_phone`, `id ← participant_id`, and the headquarters location into `address.*` (falling back to `locality.{city,state,country}` when `locations` is absent). Then **omit from the PUT body any field whose input is still empty AND whose loaded value was empty — never send `legal_name: ''`** (haiCore's `updateProfile`, `registration-service.ts:178-196`, writes every key that is not `undefined`).

  Measured addition: `GET /api/account/profile` (`src/app/api/account/profile/route.ts:10-13`) falls back to `MOCK_SESSION.participant` (`src/lib/mock-data.ts:45-67`), which is the console's OWN key shape (`company_name`, `address{line1…}`, `phone`, `email`, `website`, `description`) — the load mapper must accept both shapes: when the body has `legal_name` map haiCore's names; otherwise take the console's own keys as today.

  PR body note: the pre-existing load/save key mismatch is fixed here, not introduced — and the same mismatch is why `profile.id` was always empty, so the alias loader at `profile-form.tsx:72-73` (`if (!profile.id) return;`) has never fired. Mapping `id ← participant_id` fixes that as a side effect; call it out rather than letting it look accidental.

- [ ] **Step 4: Implement the Locations editor.** `ProfileData` gains `plants: ProfileLocation[]`; on load, `hq = profile.locations?.find(l => l.kind === 'headquarters')` fills `address.*` (line1/line2/city/state/postal_code/country) — layered on top of Step 3's field mapping — and `plants = locations.filter(kind === 'plant')`. There is no shared `Input` component and no `src/components/ui/` directory in this codebase (measured) — `profile-form.tsx` hand-rolls each `<label>`/`<input>` pair as siblings with no `htmlFor`/`id` (lines 207-269), so Testing Library's `getByLabelText` does not resolve them as written today: the codebase's own precedent for this exact shape (`src/app/account/admin/agent-config/mes-integration/_components/mes-form.tsx:40-47`) is queried in its test via `getByPlaceholderText(/agent uuid/i)` (`…/_components/__tests__/mes-form.test.tsx:19`), not `getByLabelText`, which succeeds there only for the checkbox whose `<label>` wraps its `<input>` directly (`mes-form.tsx:49-57`, test `:20`). The new plant-location inputs must add matching `htmlFor`/`id` pairs so the Step 1 test can select them with `getByLabelText`; the existing address block inputs are unchanged by this task and stay unassociated. A new `<Card title="Plant locations">` lists plants with inputs (label, line1, line2, city, state, postal code, country), **Add plant**, **Remove**. Submit builds the explicit body above (`locations[0]` = `{ id: hq?.id, kind: 'headquarters', label: 'Headquarters', address_line1: form.address.line1 || null, … }`) and PUTs it (the BFF forwards verbatim — unchanged). The read-only mode disables the plant inputs and buttons. `locations[0]` is always the headquarters and is always present; haiCore returns 400 `VALIDATION_ERROR` for any other count.

- [ ] **Step 5: Run — expect PASS**, plus the regression suite this change can actually affect: `src/app/account/manifests/__tests__/page-tabs.test.tsx` and `sharing-policy-panel.test.tsx` (there is no pre-existing `profile/__tests__/` suite to re-run — measured). `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/haiwave-api.ts src/app/account/profile
git commit -m "feat(profile): locations — headquarters from the address block + plant locations editor; PUT sends explicit haiCore fields (D-208)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The gate, HOLD, release PR body

- [ ] **Step 1: Merge up.** `git fetch origin && git merge origin/master`.
- [ ] **Step 2: Gate** (record counts): `npm run build` (0) · `~/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 --minWorkers=1` (0 failed) · `npx playwright test --list` (0 type errors). The protocol the primary haiCore carries at that moment is what the build sees; this feature imports nothing new from it. Census: `git -C /Users/samfleming/dev/hw/haiWeb-cpsync diff origin/master...HEAD -- src | grep -c '^+.*@haiwave/protocol'` must be 0 added import lines; present control: `grep -rn "@haiwave/protocol" src | wc -l` returns the existing imports (measured 293 today). This census is the reason the 3.81.0-resolved gate (protocol via `file:../haiCore/packages/protocol`, the PRIMARY tree) is binding.
- [ ] **Step 3: Visual walk on :3002** (`npx next start -p 3002` from this worktree after `npm run build`; the haiWeb bring-up memory: env from the primary's `.env.local`, never the primary's port): the seven tabs; the Counterparty updates tab against the merged haiCore (rows seeded by the haiClient live proof); the alert text verbatim; the profile locations round-trip (save, reload, plants persist). Screenshots into `.superpowers/walk-v186/` (untracked; preserve). **This walk is blocked until haiCore v1.86.0 AND haiClient 1.89.0 are merged and the haiClient live proof has seeded rows on central** — the Counterparty updates tab and the alert have nothing to render before then. Do not treat this as a gate condition for this lane's own HOLD; record it as an owed check.
- [ ] **Step 4: HOLD record** `.superpowers/PR-BODY-v1.86.md` (the haiClient PR body's shape): tab, BFF, profile locations, tab rename, copy census; gate counts; walk screenshots; merge order last; release PR `v1.86`. Record the Step 3 visual walk as an OWED CHECK (blocked on haiCore + haiClient merging first) rather than a gate condition for this HOLD. Then STOP and report to the owner. **Push and the release PR only on the owner's word in session hw-a3's window.**

---

### Task 5: Profile form — hide or disable every key with no backing haiCore profile field so nothing appears editable that does not persist

**Files:**
- Modify: `src/app/account/profile/profile-form.tsx`

**Rule:** A `ProfileData` key with no corresponding haiCore profile field (per Task 3 Step 3's load mapping) renders read-only with a caption explaining it does not persist to your ERP-facing profile, or does not render at all; a key backed by a haiCore field (e.g. `phone`, mapped from `primary_contact_phone`) stays fully editable. `tax_id` is the unbacked key named in this plan's own review observation (owner ruling #5, 2026-09-05); any other key found unbacked at implementation time (e.g. `duns`) gets the same treatment.

- [ ] **Step 1: Write the failing test.**
```ts
// profile-form: tax_id renders with no editable control (a disabled input, or plain text, captioned that it is not saved to your profile) (present control: phone IS an editable, enabled input, backed by primary_contact_phone).
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** Disable (or remove) the `tax_id` input and add its caption; audit the remaining `ProfileData` fields against Task 3 Step 3's mapping and apply the same treatment to any other key found unbacked.

- [ ] **Step 4: Run — expect PASS. `npm run build`.**

- [ ] **Step 5: Commit**

```bash
git add src/app/account/profile/profile-form.tsx
git commit -m "fix(profile): hide/disable profile keys with no backing haiCore field (tax_id) — owner ruling #5, 2026-09-05

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review

**Spec coverage → task:** §6.4 tab (header, alert, rows, pills, filter, identity select, "Not in your ERP" / "Create in ERP") → Task 2 · §6.4 BFF + client → Task 1 · §6.4 profile Locations editor → Task 3 · §6.4 tab rename → Task 2 · ruling 6 Sync all now + progress → Task 2 · ruling 7 "their last updated" → Task 2 · ruling 3 alert verbatim + dirty pill → Task 2 · §5.4 `account_admin` → Task 1 · §10 gate + walk → Task 4 · §11 boundaries (no notification; no counterparty view of the owner's rows — the BFF is owner-scoped by session) → held.
**Placeholder scan:** none.
**Type consistency:** `CounterpartyUpdateRow` / `CounterpartyUpdatesList` / `CounterpartyUpdateDecision` / `SyncNowResponse` (Task 1) consumed in Task 2 · `ProfileLocation` (Task 3) matches `ParticipantLocationSchema` field for field · client method names in Task 1 match the routes' calls.
**Verified in review round 1 (no change):** `hasRole('account_admin')` (`src/lib/auth.ts:228-240`) accepts `account_admin` and `account_owner` short-circuits; `MANIFEST_TABS` (`page.tsx:13-20`) carries exactly the six keys/labels reproduced in Task 2.
**Round 2 refinement of §6.4's alert condition (stated):** the banner means "the write is not enabled" (every capability false + an approved row — ruling 3's verbatim sentence); every other refusal or failure shows the agent's own `apply_detail` on its row (the Why column). Without this the four-verb decision would make the banner false for a matched location's refusal (C-R1). An ambiguously matched location's Keep mine is captioned as a suppression (C-R2).
**Observation for the PR body:** see Task 5 — the profile form's unbacked key (`tax_id`, no haiCore column) is hidden/disabled so nothing appears editable that does not persist; the `phone` vs `primary_contact_phone` naming was a mapping issue, resolved by Task 3 Step 3.
