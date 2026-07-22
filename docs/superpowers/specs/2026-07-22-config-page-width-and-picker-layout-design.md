# Config page width + scope-picker layout — design

**Date:** 2026-07-22
**Status:** Approved
**Branch:** v1.60 (first stacked PR)

## Problem

The step-rail configuration surfaces (e.g. `/account/sonar/watchers/new`) cap
their body at `max-w-2xl` (672px). Inside that body, the counterparty → class →
product picker nests two levels deep, so the deepest rows have lost ~56px of
width before content starts. Three visible symptoms:

1. Config sections read over-compressed; lines wrap early.
2. A product row is not visually indented under its product class. The class
   row's chevron + checkbox push its label to ~56px from the group edge, while
   the product leaf below starts its label at ~52px — the child actually sits
   4px *left* of its parent, so the hierarchy doesn't read.
3. The readiness-watcher ask inputs (quantity, target window in days, and the
   "→ ~date if run today" preview) render right-aligned in the product row's
   meta slot. There is not enough room to show the full boxes and the predicted
   date; they clip or wrap.

## Changes

### 1. Widen the config body: `max-w-2xl` → `max-w-4xl`

One class change in each of the five step-rail surfaces (the `flex-1` body
`div` next to `<StepRail>`):

- `src/app/account/sonar/watchers/new/_components/watcher-wizard.tsx` (line ~177)
- `src/app/account/sonar/audit/new/_components/audit-wizard.tsx` (line ~276)
- `src/app/account/sonar/_components/definition-editor.tsx` (line ~341)
- `src/app/account/sonar/templates/_components/template-wizard.tsx` (line ~161)
- `src/app/account/sonar/templates/_components/template-editor.tsx` (line ~128)

896px still fits a 1280px viewport beside the step rail. The step rail itself
is unchanged.

Out of scope: modals, drawers, the nomination form, and other standalone pages
that happen to use `max-w-2xl` — different pattern, not part of this problem.

### 2. Indent leaf rows in the shared accordion

`src/components/grouped-accordion/accordion-leaf-row.tsx`: add a left inset
(`pl-6`) to **both** row variants (clickable and plain), so a leaf's checkbox +
label render one clear visual tab deeper than the parent group row's label.

This is a shared-component change and intentionally applies to every consumer
(watcher scope picker, audit scope picker, provenance browse) — leaves
currently sit flush with their group label everywhere, and the fix should be
consistent.

### 3. Ask inputs move to their own line (`detailSlot`)

`AccordionLeafRow` gains an optional `detailSlot?: ReactNode` prop. When
present, it renders on a second line *beneath* the row's flex line, indented to
align under the label (i.e. inset past the control column). It renders outside
the treeitem element, as a following sibling, so row activation cannot swallow
clicks on detail-line inputs.

`src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx`:

- Move `askInputs(...)` out of `metaSlot` into `detailSlot`. The meta slot
  keeps only the monospace SKU id. `askInputs` returns null for unselected
  SKUs and for non-readiness consumers (`collectAsks` false), so the audit
  picker is untouched.
- With real room, the cluster drops its placeholder-only styling and gets
  visible labels:

  `Qty [   ] · Target window [   ] calendar days → ~Aug 21 if run today`

  Existing `aria-label`s stay. Input sizes stay small (`w-16` / `w-14`-ish);
  the preview keeps `whitespace-nowrap`.
- The orphan-SKU section (accepted SKUs missing from the public catalog) gets
  the same treatment: ask inputs render on a second line under each orphan
  label instead of inline.

**No data-flow changes.** Draft state, the emit rules (ask emitted only when
both quantity and target_days are positive), `sku_asks` shape, and the
`previewTargetDate` helper are all unchanged.

## Testing

Red → green per TDD on the structural changes:

1. `accordion-leaf-row.test.tsx` — `detailSlot` content renders below the row;
   absent prop renders nothing extra.
2. Watcher picker test — for a selected SKU with `collectAsks`, the qty/days
   inputs and predicted-date preview render (now in the detail line) and edits
   still emit `sku_asks` entries.

The width change (`max-w-4xl`) and the `pl-6` inset are pure Tailwind styling —
verified live in the browser, not pinned in jsdom.

## Risks

- `pl-6` on leaf rows shifts every accordion consumer; visual check of audit
  wizard and provenance browse alongside the watcher picker.
- Wider body slightly lengthens text lines in simple steps (Identity,
  Lifecycle); acceptable at 896px.
