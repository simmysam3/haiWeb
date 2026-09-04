# Counterparty Updates — HaiWeb lane (v1.86) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The console's half of "Counterparty updates": a **Counterparty updates** tab on the Manifests page (rows grouped by counterparty; your ERP value · represented value · their last updated · keep mine / take theirs; identity rows with a candidate select + Link; the write-not-allowed alert and dirty pills; **Sync all now** with last check-in and next slot), the BFF routes and client methods behind it, and a **Locations** editor on the Company Profile page (headquarters + child plants).

**Architecture:** One new tab component directory under the Manifests page, three BFF routes under `src/app/api/account/counterparty-updates/`, three client methods on `HaiwaveClient`. The rows table follows the data-cleansing review queue (`DataTable` + inline `Button`s + optimistic update + toast); Sync all now follows the Sonar run-now button with SWR polling. The profile's existing address block becomes the headquarters location; a plants list editor joins it; the PUT sends explicit haiCore field names plus `locations[]`. Types are local mirrors of the 3.82.0 wire shapes (the console mirrors haiCore shapes locally today); no protocol import is needed for this feature.

**Tech Stack:** Next.js (App Router, BFF routes), React, SWR / `useApi`, Tailwind, Vitest + Testing Library, Playwright (`e2e/` typecheck via `npx playwright test --list`).

**Spec:** `docs/superpowers/specs/2026-09-04-counterparty-attribute-ownership-and-updates-design.md` (byte-identical copy of haiCore's canonical spec). Wire shapes: haiCore's plan `haiCore-cpsync/docs/superpowers/plans/2026-09-04-counterparty-updates-haicore.md` Task 1 and Task 7's route table.

## Global Constraints

- Worktree `~/dev/hw/haiWeb-cpsync`, branch `v1.86-counterparty-updates`, base `de85db2` (origin/master). Never touch `~/dev/hw/haiWeb` (the :3001 console's tree) or `~/dev/hw/haiCore` (the live Central's tree).
- Release: HaiWeb **v1.86** cycle (release PR `v1.86`); no package.json bump (HaiWeb releases follow the cycle label). Merge order: after haiCore v1.86.0 and haiClient 1.89.0.
- `@haiwave/protocol` resolves via `file:../haiCore/packages/protocol` — i.e. the PRIMARY haiCore checkout. This lane never repoints or symlinks it to an unmerged tree; the gate runs against whatever the primary carries (this feature imports nothing new from the protocol). Central accepts an older minor protocol header.
- **No commercial ERP name in any user-visible string** — "your ERP" throughout.
- Every string the spec quotes is used verbatim: the alert *"Write not allowed — your agent is not permitted to update your ERP. Please update these records directly in your ERP; they will clear on the next refresh."*; the tab label **"Counterparty updates"**; the renamed tab **"Sharing posture"**.
- Tests: `~/dev/hw/vitest-lock.sh npx vitest run <file> --maxWorkers=3 --minWorkers=1` (one vitest on the machine at a time). Gate at HOLD: `npm run build` (0) · `vitest run` (0 failed) · `npx playwright test --list` (0 type errors).
- Commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; never push (owner's word in session hw-a3's window).

## File structure (the decomposition)

| file | responsibility |
|---|---|
| `src/lib/counterparty-updates-types.ts` (new) | local mirrors of the wire rows, sync state, decision, list response |
| `src/lib/haiwave-api.ts` | `listCounterpartyUpdates`, `decideCounterpartyUpdate`, `syncCounterpartyUpdatesNow` (+ interface entries beside `entityApprovalsQueue` :502) |
| `src/app/api/account/counterparty-updates/{route.ts, [id]/decide/route.ts, sync-now/route.ts}` (new) | BFF, `role: "account_admin"` on all three |
| `src/app/account/manifests/counterparty-updates/{counterparty-updates-tab.tsx, updates-table.tsx, write-alert.tsx, sync-now-panel.tsx}` (new) | the tab |
| `src/app/account/manifests/page.tsx` | tab registration; "Counterparty Manifest" → "Sharing posture" |
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
export interface CounterpartyUpdateRow {
  id: string; counterparty_participant_id: string; counterparty_name: string; side: CounterpartySide; kind: CounterpartyUpdateKind;
  attribute_key: string; source: 'profile' | 'locations' | 'library' | 'manifest' | 'erp'; label: string;
  mine: unknown; theirs: unknown; theirs_updated_at: string | null; candidates?: CounterpartyUpdateCandidate[];
  observed_at: string; status: CounterpartyUpdateStatus; decision: 'take_theirs' | 'keep_mine' | 'link' | null; decision_ref: string | null;
  decided_by: string | null; decided_at: string | null; dirty: boolean; applied_at: string | null; apply_detail: string | null;
}
export interface WriteCapabilities { customer_fields: boolean; vendor_fields: boolean; customer_ship_to: boolean; vendor_purchase_point: boolean }
export interface CounterpartySyncState { slot_utc: string; last_checkin_at: string | null; last_run_id: string | null; last_run_status: string | null; write_capabilities: WriteCapabilities | null; agent_version: string | null; in_flight_since: string | null }
export interface CounterpartyUpdatesList { rows: CounterpartyUpdateRow[]; sync_state: CounterpartySyncState | null; counterparties: Array<{ participant_id: string; name: string; pending_count: number }> }
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

- [ ] **Step 3: Implement.** Client methods in the `entityApprovalsQueue` idiom (`URLSearchParams` for the two query keys; `request<T>('POST', …, body)`). Routes with `withHaiCore(handler, { role: "account_admin" })`; decide validates with a local zod schema `z.union([z.object({ keep: z.enum(['mine','theirs']) }).strict(), z.object({ link: z.number().int() }).strict()])` and answers `NextResponse.json({ error: 'Invalid decision' }, { status: 400 })` on failure.

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
- Test: `src/app/account/manifests/__tests__/page-tabs.test.tsx` (seven tabs; "Sharing posture"; "Counterparty updates" after "Entity Approvals"), `src/app/account/manifests/counterparty-updates/__tests__/counterparty-updates-tab.test.tsx`

**Interfaces:**
- Consumes: Task 1's client via `fetch('/api/account/counterparty-updates…')` (the `useApi` / `fetch` idiom of `review-queue-panel.tsx`); `DataTable`/`Column`, `Button`, `Card`, `Pill`, `useToast`.
- Produces: `<CounterpartyUpdatesTab />` (default export used by `page.tsx`); `<UpdatesTable rows counterparties onDecide />`; `<WriteAlert state rows />`; `<SyncNowPanel state onStarted />`.

Layout (spec §6.4): header row — **Sync all now** (disabled while `sync_state.in_flight_since` is set or a click is pending; after `started` the list re-fetches every 10 s until `last_run_id` changes or 5 minutes pass; `already_running` shows "A sync is already running"; `no_endpoint` shows "Your agent has not registered an endpoint yet"; `agent_unreachable` shows "Your agent could not be reached") · "Last check-in <relative> · next scheduled <slot_utc> UTC" · the filter (`pending` default / `decided` / `all`) and a counterparty select built from `counterparties[]`. Then **`<WriteAlert>`** (role="alert") when any visible row is `approved && dirty`, or when `sync_state.write_capabilities` is non-null and every flag is false while an `approved` row exists. Then the table, grouped by counterparty (a group header per `counterparty_name` with its pending count), columns: attribute (`label`, with a `source` pill) · **Your ERP value** · **Represented value** · **Their last updated** (relative + absolute title; "—" when null) · status pill (`pending` · `approved — awaiting your agent` · `dirty — apply in your ERP` · `applied` · `kept` · `converged`) · actions: `pending` attribute/location rows → **Keep mine** / **Take theirs** (a location row with `mine === null` reads "Not in your ERP" and its button says **Create in ERP**; `candidates` on a location row means "matched ambiguously" and shows both refs with no Take theirs); `pending` identity rows → a `<select>` of candidates (`name · erp_id · city, state`) + **Link**, or "No candidate records" when empty. A decision POSTs, optimistically replaces the row from the response, toasts `Kept your value` / `Approved — your agent will apply it` / `Linked`, and reverts with a toast on a non-2xx. Values render: strings as text; numbers with locale grouping; `{ amount_usd }` as `$5,000,000`; booleans as Yes/No; an address tuple `{ lines[], city, state, postal_code, country }` as two lines; anything else as JSON in `<code>`.

- [ ] **Step 1: Write the failing tests**
```ts
// page-tabs: seven tab buttons; 'Sharing posture' present and 'Counterparty Manifest' absent; 'Counterparty updates' after 'Entity Approvals'; clicking it renders the header "Sync all now".
// tab (fetch stubbed per URL): renders a group per counterparty with the pending count; a row shows label, your value, represented value, "2 days ago"-style last updated; Keep mine POSTs { keep: 'mine' } and the row becomes kept without a refetch (fetch called exactly twice: list + decide); Take theirs POSTs { keep: 'theirs' }; a location row with mine null shows "Not in your ERP" and "Create in ERP"; an identity row's Link POSTs { link: 7 } for the selected candidate; the alert appears when an approved dirty row exists and reads the verbatim sentence; it also appears when all write capabilities are false and an approved row exists (present control: absent when capabilities are true); Sync all now POSTs sync-now, shows "Sync started", disables itself, and re-fetches until last_run_id changes (fake timers); filter changes the query string; a 409 on decide reverts the row and toasts.
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** the four components and the page change:
```ts
const MANIFEST_TABS = [
  { key: "counterparty", label: "Sharing posture" },
  { key: "library_sharing", label: "Library — Sharing" },
  { key: "library_requirements", label: "Library — Requirements" },
  { key: "pricing", label: "Baseline Pricing" },
  { key: "sharing", label: "Audit Permissions" },
  { key: "entity_approvals", label: "Entity Approvals" },
  { key: "counterparty_updates", label: "Counterparty updates" },
];
// … {activeTab === "counterparty_updates" && <CounterpartyUpdatesTab />}
```
`sync-now-panel.tsx` composes its own button (the run-now button navigates to a run page; this one stays on the tab), with the busy/disabled and `role="alert"` error idioms copied from `run-now-button.tsx`. Polling: `useEffect` with `setInterval(refetch, 10_000)` while `awaitingRunId` is set, cleared on change or after 30 ticks.

- [ ] **Step 4: Run — expect PASS. `npm run build`.**

- [ ] **Step 5: Commit**

```bash
git add src/app/account/manifests
git commit -m "feat(console): Counterparty updates tab — grouped rows, keep/take/link, write alert, Sync all now; Counterparty Manifest tab renamed Sharing posture

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Locations on the Company Profile — headquarters + plants, explicit PUT mapping

**Files:**
- Modify: `src/lib/haiwave-api.ts` (`ParticipantProfile` gains `locations?: ProfileLocation[]`; export `ProfileLocation`)
- Modify: `src/app/account/profile/profile-form.tsx` (`ProfileData` :11-27; load ~:58-80; submit :150-175; the address block; a new "Plant locations" section)
- Test: `src/app/account/profile/__tests__/profile-form-locations.test.tsx` (create the directory if absent; the `page-tabs.test.tsx` render idiom with `fetch` stubbed)

**Interfaces (produces):**
```ts
export interface ProfileLocation { id?: string; kind: 'headquarters' | 'plant'; label: string; address_line1?: string | null; address_line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null; updated_at?: string }
// PUT /api/account/profile body (explicit haiCore field names — the form's own keys are no longer sent):
// { legal_name, dba_name, website_url, vendor_description, primary_contact_name, primary_contact_email, primary_contact_phone,
//   business_address_city, business_address_state, business_address_country,   // mirrored from the headquarters location
//   locations: [ { kind: 'headquarters', … }, ...plants ] }
```

Today the form sends its own keys (`company_name`, `address`, `phone`, …) and haiCore ignores them (measured: `RegistrationService.updateProfile` maps only its known snake_case fields) — so address edits never persisted. This task maps every field the form already has explicitly; fields haiCore has no column for stay client-side (a §L note in the PR body).

- [ ] **Step 1: Write the failing test**
```ts
// renders the headquarters block from profile.locations[kind=headquarters] (address_line1 → the line1 input) and one "Plant locations" card per plant;
// "Add plant" appends an empty plant row (label required); "Remove" drops it;
// Save PUTs a body with legal_name (from the company name input), business_address_city mirrored from HQ, and locations with EXACTLY one headquarters followed by the plants (assert the parsed body);
// a profile with no locations renders an empty HQ block and no plants (present control) and Save still sends one headquarters.
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement.** `ProfileData` gains `plants: ProfileLocation[]`; on load, `hq = profile.locations?.find(l => l.kind === 'headquarters')` fills `address.*` (line1/line2/city/state/postal_code/country) and `plants = locations.filter(kind === 'plant')`. The address inputs keep their ids (the existing test selectors); a new `<Card title="Plant locations">` lists plants with inputs (label, line1, line2, city, state, postal code, country), **Add plant**, **Remove**. Submit builds the explicit body above (`locations[0]` = `{ id: hq?.id, kind: 'headquarters', label: 'Headquarters', address_line1: form.address.line1 || null, … }`) and PUTs it (the BFF forwards verbatim — unchanged). The read-only mode disables the plant inputs and buttons.

- [ ] **Step 4: Run — expect PASS**, plus the existing profile tests. `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/haiwave-api.ts src/app/account/profile
git commit -m "feat(profile): locations — headquarters from the address block + plant locations editor; PUT sends explicit haiCore fields (D-208)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The gate, HOLD, release PR body

- [ ] **Step 1: Merge up.** `git fetch origin && git merge origin/master`.
- [ ] **Step 2: Gate** (record counts): `npm run build` (0) · `~/dev/hw/vitest-lock.sh npx vitest run --maxWorkers=3 --minWorkers=1` (0 failed) · `npx playwright test --list` (0 type errors). The protocol the primary haiCore carries at that moment is what the build sees; this feature imports nothing new from it.
- [ ] **Step 3: Visual walk on :3002** (`npx next start -p 3002` from this worktree after `npm run build`; the haiWeb bring-up memory: env from the primary's `.env.local`, never the primary's port): the seven tabs; the Counterparty updates tab against the merged haiCore (rows seeded by the haiClient live proof); the alert text verbatim; the profile locations round-trip (save, reload, plants persist). Screenshots into `.superpowers/walk-v186/` (untracked; preserve).
- [ ] **Step 4: HOLD record** `.superpowers/PR-BODY-v1.86.md` (the haiClient PR body's shape): tab, BFF, profile locations, tab rename, copy census; gate counts; walk screenshots; merge order last; release PR `v1.86`. Then STOP and report to the owner. **Push and the release PR only on the owner's word in session hw-a3's window.**

---

## Self-review

**Spec coverage → task:** §6.4 tab (header, alert, rows, pills, filter, identity select, "Not in your ERP" / "Create in ERP") → Task 2 · §6.4 BFF + client → Task 1 · §6.4 profile Locations editor → Task 3 · §6.4 tab rename → Task 2 · ruling 6 Sync all now + progress → Task 2 · ruling 7 "their last updated" → Task 2 · ruling 3 alert verbatim + dirty pill → Task 2 · §5.4 `account_admin` → Task 1 · §10 gate + walk → Task 4 · §11 boundaries (no notification; no counterparty view of the owner's rows — the BFF is owner-scoped by session) → held.
**Placeholder scan:** none.
**Type consistency:** `CounterpartyUpdateRow` / `CounterpartyUpdatesList` / `CounterpartyUpdateDecision` / `SyncNowResponse` (Task 1) consumed in Task 2 · `ProfileLocation` (Task 3) matches `ParticipantLocationSchema` field for field · client method names in Task 1 match the routes' calls.
**Observation for the PR body (§L candidate, not this lane's fix):** the profile form's non-address keys that haiCore has no column for (`tax_id` display, `phone` vs `primary_contact_phone` naming) were mapped where a haiCore field exists and left client-side otherwise.
