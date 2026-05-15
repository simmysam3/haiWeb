# Phantom Demand template config — counterparty + SKU redesign

**Date:** 2026-05-15
**Surface:** `http://localhost:3001/account/sonar/templates/new?observation_class=phantom_demand`
**Status:** Design approved; ready for implementation plan.

## Problem

The Phantom Demand branch of the new-template scope picker uses free-text inputs
for **counterparty** (a participant-ID text box) and **SKUs** (comma-separated
text). There is no lookup, no validation that the counterparty is an eligible
trading partner, and no way to browse a partner's catalog. Phantom Demand can
only legitimately run against an established trading pair, so a free-text
counterparty invites invalid runs. The field order also buries the most dynamic
selections in the middle of the form, and the "Hypothetical Timeline" label is
unclear.

## Goals

1. Counterparty chosen from a **searchable, always-visible list of eligible
   trading partners** (single select), not free text.
2. Once a counterparty is selected, SKUs chosen by **browsing that partner's
   catalog** (class → product rows, multi-select) **plus** a free-text "SKU I
   have in mind" escape hatch for SKUs not in the catalog.
3. Counterparty and SKUs are the **last elements on the form** (most dynamic
   selection last).
4. Rename "Hypothetical Timeline" → **"Target Delivery Date"** (label only).

## Non-goals

- No `@haiwave/protocol` or haiCore changes. The Phantom Demand scope object
  shape is unchanged.
- No new BFF endpoints — reuse existing ones.
- No changes to the audit/watcher scope-picker branches' internal behavior
  (only their on-page position moves, see §Ordering).
- No changes to the audit-nominations flow (its components are a *pattern
  reference*, not modified or shared).
- Edit mode is unaffected: `template-form.tsx` only renders `<ScopePicker>`
  when `!isEdit`, so this is a create-flow change.

## Locked decisions

| # | Decision |
|---|----------|
| D1 | Counterparty list = **`status === 'trading_pair'` only**. `approved` connections are excluded entirely (not shown). |
| D2 | Counterparty UI = **always-visible searchable inline list** (audit-nominations `vendor-picker-step.tsx` pattern), **single select**. |
| D3 | Partner row fields: **name · industry · location · status**. |
| D4 | SKUs = multi-select from partner catalog (class rows expand to product rows, `catalog-step.tsx` pattern) **plus** a free-text add box. Per-SKU display: **product name · product id**, grouped by class; selected SKUs render as removable chips (catalog + free-text unified, deduped). |
| D5 | "Hypothetical Timeline" → **"Target Delivery Date"**: label only. Same `datetime-local` input, same `hypothetical_timeline` ISO-string value, no schema change. |
| D6 | Implementation = **Approach 2**: new PD-scoped components; nominations untouched. |
| D7 | Field order within PD scope: **Hypothetical Quantity → Target Delivery Date → Counterparty → SKUs**. |
| D8 | `<ScopePicker>` relocates in `template-form.tsx` to render **after** the Enabled/Retention row (just before error/buttons), **for all modalities** (audit/watcher scope also moves down — accepted for consistency). |
| D9 | Changing the selected counterparty **clears `skus`** (catalog is partner-specific) with a subtle inline note. |

## Architecture (Approach 2)

New components under `src/app/account/sonar/templates/_components/`:

- **`phantom-demand-scope-fields.tsx`** — owns the entire PD scope sub-form.
  Props: `{ value: <PD scope>, onChange: (next) => void }`. Renders, in order
  (D7): Hypothetical Quantity, Target Delivery Date, `<CounterpartyPicker>`,
  `<PartnerSkuPicker>`. `scope-picker.tsx`'s `phantom_demand` branch is
  replaced by `<PhantomDemandScopeFields value={pdValue} onChange={onChange} />`.
  Audit/watcher branches are untouched.

- **`counterparty-picker.tsx`** — search input + scrollable list. Fetches
  `GET /api/account/partners`, filters client-side to
  `status === 'trading_pair'` (D1), single-select, emits the chosen
  `participant_id`. Rows show name · industry · location · status (D3).
  Cancellable effect + loading/error states modelled on
  `vendor-picker-step.tsx`. Empty-eligible state shows an explanatory message
  ("No trading pairs yet — Phantom Demand requires an established trading
  pair").

- **`partner-sku-picker.tsx`** — props include the selected counterparty id and
  the selected SKU set. Disabled (with hint) until a counterparty is chosen.
  On counterparty change, fetches
  `GET /api/account/partners/{id}/catalog/classes`; lazy-loads products per
  class via `GET /api/account/partners/{id}/catalog/products?class_id=&page=1&size=500`
  (mirrors `catalog-step.tsx`). Multi-select product ids. Free-text add box:
  trims, ignores empties, dedupes against the existing set, supports removal.
  Selected SKUs render as removable chips.

### Data flow

All fetches are client-side to existing BFFs; no new endpoints. The PD scope
object is unchanged:

```
{ kind:'phantom_demand', authorization_basis:'bilateral',
  counterparty: <participant_id>, skus: string[],
  hypothetical_quantity: number, hypothetical_timeline: string|null }
```

`counterparty` = selected participant id. Catalog-selected SKUs and free-text
SKUs both populate `skus`. Selecting a different counterparty resets `skus`
to `[]` (D9).

### Ordering change (D8)

`template-form.tsx` currently renders: name → modality → CadencePicker →
ScopePicker → Enabled/Retention → error → buttons. Move `<ScopePicker>` to
render **after** the Enabled/Retention block (immediately before the error
message + buttons). This applies to every modality.

## Validation / UX

- When `observation_class === 'phantom_demand'`, the Create button is gated on
  a non-empty selected counterparty (client-side guard, mirrors the
  provenance-key 400-avoidance pattern). Empty `counterparty` must never be
  submitted.
- SKU emptiness: the PD scope schema's `skus` cardinality (empty allowed vs
  `.nonempty()`) is verified against `@haiwave/protocol` during planning; the
  submit guard matches whatever the schema requires.
- Counterparty-change → `skus` cleared, with a subtle inline note so the user
  understands why their SKU selection reset.

## Testing

Vitest + mocked `fetch`, matching existing component-test conventions:

- **counterparty-picker:** filters out non-`trading_pair`; search filter;
  single-select replaces prior selection; emits participant id; empty/loading/
  error states.
- **partner-sku-picker:** disabled without a counterparty; loads classes;
  lazy-loads products on class expand; multi-select; free-text add trims/
  dedupes/empties-ignored; chip removal; resets when counterparty prop changes.
- **phantom-demand-scope-fields:** renders fields in D7 order; "Target Delivery
  Date" label present and "Hypothetical Timeline" absent; `onChange` emits the
  unchanged PD scope shape.
- **scope-picker.test.tsx:** PD-branch assertions updated to assert delegation
  to `<PhantomDemandScopeFields>` (audit/watcher assertions unchanged).
- Confirm `template-form.tsx` tests still pass after the ScopePicker
  relocation.

## Risks

Low. `/api/account/partners` BFF already maps `location`, `industry`,
`status`, `company_name`, `id`; the partner-catalog BFFs already exist and are
exercised by the nominations flow. The only intentional behavior change beyond
the PD branch is the cross-modality on-page position of `<ScopePicker>` (D8),
which is accepted.
