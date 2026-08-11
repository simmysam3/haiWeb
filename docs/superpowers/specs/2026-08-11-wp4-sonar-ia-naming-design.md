# WP4 — Sonar IA + naming (v1.73 lane)

**Status:** Approved design, pending implementation plan.
**Repo:** haiWeb (default branch `master`), plus one severable cross-repo rider (protocol
3.67.0 + one haiCore mint site) for Ruling-4 aliases.
**Owner rulings this builds on (2026-08-10 walk — do not re-litigate):** Ruling 2
(three-surface model: Phantom Demand = ad-hoc probe; Watchers = scheduled standing
verification; surface 3 = agent console, NOT haiWeb), Ruling 4 (counterparty naming:
direct relationships always by name; withheld/sub-tier parties as
`<direct name> + Supplier 'x'`). Walk findings absorbed: #16, #18, #19, #22.
**Spec-cycle decisions (owner, 2026-08-11):** framing = IA redesign (#19 centerpiece) +
riders; two-surface Sonar nav; in-place evolution (zero URL changes beyond one orphan
redirect); full rider set kept after size review; Ruling-4 walk-node aliases via the
EXISTING PD run-scoped alias mechanism (owner: "haiWeb has the ability to resolve those
hashes" — verified: `supplier_alias` at `packages/protocol/src/bom/bom-tree.ts:80`,
minted at `apps/core/src/services/bom-loader/redact-tree.ts:179`, rendered by
`VerifiedUndisclosedChip`).
**Explorer baseline:** haiWeb master-holder = `~/dev/hw/haiWeb-v169-mrp` @ `383a3f6`
(the plain `~/dev/hw/haiWeb` is PARKED at v1.66). Zero open haiWeb PRs at spec time.
File:line pins below were verified at that commit — re-read at dispatch.

## 1. What this is

Sonar's web IA becomes legible as the two web surfaces of the three-surface model, the
watcher page family gets one name, and the walk's four findings plus the adjacent
defects the exploration surfaced are fixed in place — no page restructuring, no data-flow
changes, zero URL moves beyond retiring one orphan into a redirect.

**Out of scope / reassigned:** the hex-render sites named in early WP4 notes
(`EvalOpportunityDetail`, `ManifestStatus`) are haiClient frontend files, not haiWeb —
reassigned to a future haiClient cleanup rider. Surface 3 itself is WP3's (in flight).

## 2. IA & navigation (#19 centerpiece)

Nav (SSOT `src/components/account-nav.tsx`): the Sonar section becomes
**Dashboard · Phantom Demand · Watchers · Watcher Backlog · Grounded Forecasts ·
Request Management**.
- "Sonar Dashboard" moves INTO the Sonar section from Account Management — nav entry
  only, URL unchanged.
- One name family: nav "Watcher Management" → **"Watchers"**; page titles pinned to the
  same word. "Watcher Backlog" keeps its label and its `/sonar/posture/changes` URL.
- The nav says nothing about surface 3 (ruling 2).

Three mechanical fixes:
1. **Routing table** — `templates/_lib/run-detail-href.ts` routes watcher runs to
   `watchers/[id]` (its own comment "no per-run detail page" is stale — the page
   exists) and audit runs to the AUDIT detail route (today they mis-route to the
   watcher path). The Activity feed's `detail_href` builder
   (`api/account/sonar/dashboard/activity/route.ts:174`) and
   `watcher-signals-card.tsx:20` get the same correction. Clicking a run in Activity
   lands on THAT run.
2. **Orphan page** — `/account/sonar/watcher/dashboard` (singular; "Watcher —
   Continuous observation") becomes a permanent redirect to the Watchers list; its
   run-history role is already served by the list page's history column pack.
3. **`walk.spec` updates are enumerated work** — e2e pins the orphan URL by design
   (`e2e/walk.spec.ts:126, 222-224`); every rename lists its spec update beside it.

Must not break: the `templates/[id]` consumer set the last retirement deliberately
spared (`templates/page.tsx:15-18`; `usage/_components/*` still double-hop through
`/sonar/templates/${id}`); the audit branch's consumers while it is repointed.

## 3. Rider fixes

**3.1 Signal panels.** `CounterpartiesGrid` (`watchers/[id]/_components/
counterparties-grid.tsx`) renders 5 of 8 signal types; results for the other three
still move the vendor's gap-tier score with no visible explanation. Add panels for
`order_promise_schedule` (promised vs current portions per line, completion slip
delta), `order_fulfillment_history`, and `soft_quoted_lead_time`, following the five
existing panels' idiom, copy hand-authored in haiWeb. Fixes the walk's "no OPS row
rendering" and its two siblings; a watcher subscribing OPS without `sku_asks` stops
rendering nothing.

**3.2 Wizard picker (#22).** `WatcherScopePicker` → `BilateralCounterpartiesSkusFields`
currently draws its counterparty universe from `/api/account/sonar/audit/wizard-options`
(accepted audit scopes — empty without audit history; the empty state prescribes audit
ceremony). The watcher wizard switches to a per-signal universe: active bilateral
connections (the trading-pair gate OPS enforces), via the partners route. The shared
component gains a `universe` prop; the audit wizard keeps today's behavior. Preserved:
`emitWith`'s scope derivation and the submit-summary bar (the 3.63.0-walk fix).
⚠ SERVER HALF VERIFIED FIRST: haiCore's `resolveTemplateScopeIds` maps emitted scope
back onto accepted audit scopes. If watcher template creation server-side also gates
counterparties on audit scopes, the fix INCLUDES relaxing that gate for watcher
templates (authorization basis = trading pair) — a declared haiCore touch, decided at
the plan's picker task after reading the resolution path, never smuggled.

**3.3 Heartbeat alert (#18).** `dashboard-alert-bar.tsx` payload gains the jailed
agents' NAMES (already available — `account/page.tsx:62-63` filters `listAgents()`;
no new fetch). Copy renders the names ("Unreachable: Arno, Mekong +2 more") and points
at the real Agents section (today it names "Agent Management", which doesn't exist,
whose nearest page is a ComingSoon stub). Preserved: null-means-unknown (an outage
never renders as an accusation); keying on `jailed`, never `active === 0`.

**3.4 Backlog filters (#16).** `posture/changes/filter-pills.tsx`: kind pills move to
their own line below the params; Showing/dates/partner group onto the "showing:" row
(the walk ruling verbatim). The partner field stops being a raw-UUID paste box —
name-resolving select over the partners list. Pills route through `<Pill>` (house
rule); URL-param state and `?page` resets preserved.

**3.5 Pill/copy integrity.** `pill.tsx:157`'s hand-mirror of protocol's
`CHANGE_KIND_DEFINITION` gets a cross-boundary vitest pin (TEST files may value-import
protocol; client components may not under Turbopack — the reason the mirror exists).
`upstream_risk_reported` (lands with WP3's 3.66.0) is added to: the Watcher Backlog
kind allowlist (`_lib/event-kind-pills.ts`), `PILL_DEFINITIONS`, and an AUTHORED feed
label (`describe-change.ts` gets an authored-overrides map over its titlecase
fallback). Dormant until WP3 merges; visible the day it lands.

**3.6 Terminality tightening.** `PILL_DEFINITIONS`'s watcher-status category becomes
`Record<WatcherRunStatus, …>`; the five comparison-chain sites (failure banner
`watchers/[id]/page.tsx:162`; latest-usable allowlists `watcher-dashboard.tsx:39` +
`cross-modality/route.ts:63`; polling gates `run-history.tsx` + `watcher-dashboard
.tsx:34`; inverted `registration-detail.tsx:47`) move to typed Records or shared
`isTerminal`/`isUsableRun` helpers with exhaustiveness — a 7th `WatcherRunStatus`
member fails the BUILD instead of silently mis-rendering.

## 4. Ruling-4 naming rider (the one cross-repo piece; severable)

**One visual convention, two mechanisms — deliberate.** Rendered form everywhere:
`<direct name> + Supplier 'x'`. The OPS breadcrumb (WP3) is vendor-minted and
relationship-stable (hash). Central-redacted WATCHER WALK NODES reuse PD's run-scoped
mechanism: plain letter aliases (A, B, …), first-encounter order per run. Run-scoped
letters satisfy the chip's existing tooltip promise ("stable within this run only …
cannot be matched across runs or by other buyers") strictly; reuse beats a third scheme.

- **Protocol 3.67.0** (additive; QUEUED BEHIND WP3's 3.66.0 — never rides agent5's
  frozen mint; if WP3 slips, everything else in WP4 ships without this rider): one
  optional `supplier_alias` field on the watcher observation node, mirroring
  `bom-tree.ts:80`'s shape/comment.
- **haiCore:** one mint site in the walk's redaction step (`disclosure-redaction.ts`'s
  `nullSubtierIdentity` already visits every redacted node). That is the entire
  central footprint.
- **haiWeb:** the three phrasings ("Identity withheld" / "Vendor Name Not Disclosed" /
  "identity redacted") collapse into the one chip treatment; both watcher call sites
  (`counterparties-grid.tsx:314`, `latest-snapshot.tsx:171`) pass the alias; rendered
  as `<parent node's name> + Supplier 'A'` where the parent is known, `Supplier 'A'`
  at the root. `tree-view.tsx`'s `NodeDisplay` union is the better-built model —
  `counterparties-grid`'s two-string treatment converges on it.

**The landmine fix (makes Ruling 4 honest):** three distinguishable states —
*redacted* (chip, decided by the WIRE FLAG only, never inferred from a lookup miss);
*unresolved* (id known, name lookup failed → truncated id + "name unavailable", never
the chip); *mock* (the partners route's `MOCK_PARTNERS` fallback is gated OUT of
production responses, so a haiCore outage degrades to *unresolved*, never to fake
names). `counterpartyName` stays computed for sort/search; it stops informing the
redaction decision.

## 5. Guarantees

- The Watcher Backlog ↔ audit Event Backlog kind partition stays disjoint (allowlist +
  inverse, re-applied server-side); `upstream_risk_reported` joins the watcher side
  only; a pin test asserts disjointness.
- Every new shared constant lives OUTSIDE `'use client'` modules (a client-module
  const is an opaque reference on the server — the `event-kind-pills` lesson).
- Components with live `<details>` (wizard orphan-SKU list
  `bilateral-counterparties-skus-fields.tsx:504`, `tree-view.tsx:202`) are tested by
  presence, not visibility (jsdom `<details>` blind spot).
- House patterns: every pill through `<Pill>` + `PILL_DEFINITIONS` entry; drill-downs
  through `<DetailChevron expanded>`; BFF routes via `withHaiCore`; degraded lanes via
  `unwrapBestEffort`.
- Protocol value-imports appear ONLY in test files.

## 6. Testing

TDD red/green; named mutation per declared constraint: drop allowlist disjointness →
pin fails; un-gate the mock fallback → three-state test fails; remove a signal panel →
every-scoring-signal-has-a-panel test fails; add a scratch 7th `WatcherRunStatus` →
build fails (the tightening's proof); routing-table mapping test covers BOTH run
types. Gates: haiWeb build + vitest (floor at plan Task 1) + Playwright walk suite
with its enumerated updates.

## 7. Walk plan (owner account, running dev stack)

Sonar nav reads as two surfaces · Activity click lands on the clicked run · run detail
shows OPS/fulfillment/soft-quote panels · a redacted node reads `<parent> + Supplier
'A'` (alias rider; only if 3.67.0 shipped) · backlog shows the new layout with a
named-partner select · wizard picker populated from trading pairs with zero audit
history · heartbeat alert names the jailed agents and links somewhere real. Each
mergeverify row names WHICH account sees what.

## 8. Sequencing & numbering

haiWeb lane `v1.73`. haiWeb work has NO dependency on WP1/WP2/WP3 merges except:
3.5's allowlist entry is dormant until WP3's 3.66.0 lands, and §4's alias rider queues
behind it (protocol 3.67.0 + the haiCore mint site + a possible §3.2 haiCore gate
relaxation are the lane's only central touches — each declared, numbered through the
orchestrator, zero haiCore PG migrations). Registry rows if any security decision
emerges (mock-gating may warrant one) take the next free D-number via the
orchestrator at write time.
