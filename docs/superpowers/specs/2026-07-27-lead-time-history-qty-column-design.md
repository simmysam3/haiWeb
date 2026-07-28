# Lead-time history: per-run quantity column + header-row rework

**Date:** 2026-07-27
**Repo:** haiWeb only — no protocol change, no haiCore change, no migration
**Branch:** `qty-column-header`, based on `pd-obligations-redaction` (`9917dfc`)
**Surface:** `/account/sonar/watchers/<run_id>` — readiness watcher run-detail page

## Problem

The lead-time history table on the watcher run-detail page shows the ask quantity as a
single pill in the **Soft-quoted** column header:

```tsx
<Pill category="lead_time_col" value="ask_quantity">qty {askQuantity}</Pill>
```

`askQuantity` is one scalar taken from the *current* configuration
(`readiness-report.tsx:78` → `sku.ask?.ask_quantity ?? 0`). The table renders many
rows, one per run, spanning weeks of history.

**This makes the table incorrect, not merely awkward.** The ask quantity is editable on
a live watcher; each completed run is fixed at whatever quantity it ran with. When the
quantity changes, every historical row is relabelled with the new number.

Observed on watcher run `f57a75b2-941f-42a0-8716-d6bf0b54c24e` (template
`2b931320-b24f-49da-ba3b-4a728f0b0022`) at the time of writing:

| run_at | recorded ask_quantity | currently displayed as |
|---|---|---|
| 2026-07-27 17:12 | 25 | 25 |
| 2026-07-27 14:00 | 23 | **25** |
| 2026-07-26 … 2026-07-22 (6 runs) | 23 | **25** |

Seven rows misreport the quantity they were resolved for.

Two secondary problems, both raised directly:

1. Pills are used as column headers. They read as status chrome, not as table structure.
2. The header row does not separate itself from the data.

## Design

### 1. Quantity becomes a per-run column

The per-run value already exists in the protocol and needs no new plumbing.
`SoftQuotedLeadTimePayloadSchema` (`packages/protocol/src/watcher/result.ts:113-120`)
carries `ask_quantity: z.number().int().positive()` at line 117 on every soft-quote
result, written at run time.

- `LeadTimeHistoryRow` gains `ask_quantity: number | null`.
- `pivot-readiness.ts` → `foldSignalIntoRow()` reads `soft.ask_quantity` inside the
  existing `soft_quoted_lead_time` case. `emptyRow()` seeds it `null`.
- `LeadTimeHistoryTable` drops its `askQuantity` prop; `readiness-report.tsx` stops
  passing it.

The SKU-level header line in `readiness-report.tsx:68` — which renders the configured
`ask_quantity` and `target_days` as `Ask: <n> units within <d> calendar days` — is
unchanged. It correctly describes the *current* ask. The header states what is being
monitored now; the table states what each run actually used.

### 2. Header row — grouped, no pills

Two-tier header:

- **Group tier:** `Lead time (days)` in teal, `font-bold`, spanning Published /
  Calibrated / Soft-quoted, with a `1px slate-300` bottom rule. Run date, Qty and
  Available capacity span it with empty cells.
- **Column tier:** `bg-slate-50`, uppercase, `2px slate-300` bottom rule — this rule is
  what separates header from body.

Column order: `Run date · Published · Calibrated · Soft-quoted · Qty · Available capacity`.
Qty follows Soft-quoted because the quantity is what the soft quote was resolved for.

Because the group label carries the unit, lead-time cells render `30` rather than `30d`.
This applies only to the three columns under the group. `Ship delta` in the order-state
table keeps `+1d` — it sits outside any group.

Rejected during design: a navy header band. It read well in isolation but each vendor
block stacks three tables and there are several vendor blocks per SKU, so the band
repeated heavily. Grouping achieves the separation without adding weight.

### 3. Definitions survive the pills

Each removed header pill carried a definition tooltip. Those definitions stay, moving to
an `ⓘ` affordance on the header text.

`PILL_DEFINITIONS` is a private module const (`pill.tsx:5`) and the tooltip interaction
lives inside `Pill` itself — hover/focus/click toggle, Escape to dismiss,
`aria-describedby`, and an `sr-only` fallback when closed. A new header component needs
both.

**Approach: extract, don't duplicate.**

- New `src/components/definition-tip.tsx` exporting `<DefinitionTip>`, which owns the
  tooltip behaviour and is consumed by both `Pill` and the new `<ColumnHeader>`. One a11y
  implementation, no drift.
- New `definitionFor(category, value): string | undefined` exported from `pill.tsx`
  resolves copy. The raw `PILL_DEFINITIONS` record stays private.
- `Pill`'s public API (`PillProps`) does not change, so its existing suite pins the
  extraction as behaviour-preserving.

New `src/components/column-header.tsx` exporting
`<ColumnHeader label category value className>`. It renders the **complete `<th>`**,
not content nested inside a caller-supplied one — callers replace their whole
`<th>…</th>` with `<ColumnHeader …/>`. It resolves its copy through `definitionFor()`
and renders the `ⓘ` only when a definition resolves, so `Run date` and the order-state
columns without definitions stay plain. It is not a pill and does not use `rounded-full`,
so the haiWeb CLAUDE.md pill rule is not engaged.

The group-tier label (`Lead time (days)`) is not a `<ColumnHeader>` and carries no `ⓘ` —
it is a plain spanning `<th>`. It is a unit annotation, not a defined term.

### 4. Ship delta

`order-state-table.tsx:88` renders the page's only other pill-as-header. It converts to
`<ColumnHeader>` on the same rule. Its table keeps a single-tier header — Active orders
and Recent fulfillments have no column group worth drawing, and adding one would make the
grouping decorative rather than meaningful.

### 5. Copy change

`lead_time_col.ask_quantity` currently reads:

> "Ask quantity: the forward-demand quantity and target date you want this SKU to be
> sourceable for."

That describes a forward-looking configuration value. The column is now historical and
per-run, so it becomes:

> "Ask quantity: the forward-demand quantity this run resolved the soft quote for.
> Fixed at run time — editing the watcher's ask changes later runs, not this one."

## Edge cases

- **Run with no soft-quote result** → `ask_quantity` stays `null` → renders `—`, matching
  the other nullable columns. This is live today: several runs on the observed watcher
  have null `order_fulfillment_history` payloads, and the same shape applies to
  soft-quote.
- **Quantity changing mid-history** is the normal case, not an error. No annotation, no
  highlighting — the differing numbers speak for themselves.
- **`soft_quoted_unavailable`** rows keep their existing `not available` cell in the
  Soft-quoted column. The Qty cell is independent and still renders its recorded value if
  present.

## Testing

Red/green, one cycle at a time.

Existing `lead-time-history-table.test.tsx` goes red in three places, and those failures
are the specification:

- `expect(screen.getAllByTestId('pill')).toHaveLength(5)` — no pills remain in the header
- `screen.getByText('34d')` and `screen.getByText('30d')` — suffix dropped

New coverage:

- `pivot-readiness.test.ts` — a soft-quote result folds its `ask_quantity` onto the run's
  row; a run without one leaves `null`.
- `lead-time-history-table.test.tsx` — a mixed-quantity fixture (one row at 25 over rows
  at 23) asserts each row shows its own value. This is the regression guard for the bug
  in **Problem**.
- `lead-time-history-table.test.tsx` — the `ⓘ` exposes the same definition copy the pill
  did, and `Run date` still has none.
- `pill.test.tsx` — every assertion must pass unchanged across the `<DefinitionTip>`
  extraction, which is behaviour-preserving. This does **not** extend to the §5 copy
  change: `pill.test.tsx:179` pins the current `ask_quantity` wording with
  `/forward-demand quantity and target date/i`, and that regex must be updated in the
  same commit as the copy. Rewording deliberately changes content; the extraction does
  not.

`npx tsc --noEmit` must be run separately from `npm run build`; Next's build does not
type-check `.test.tsx`.

## Out of scope

- Editing the ask quantity. It already works — that is what produced the 23 → 25 change.
- Any protocol, haiCore, or database change.
- Other tables: `watcher-column-packs.tsx`, `counterparties-grid.tsx`,
  `resumption-history-table.tsx`.
- Retrofitting `<ColumnHeader>` across tables outside this page.

## Follow-up worth recording

haiWeb CLAUDE.md documents the pill rule and the row-detail chevron rule but says nothing
about column headers. Once this lands, it should gain a line: column headers use
`<ColumnHeader>`, never `<Pill>`. Not part of this change.
