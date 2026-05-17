# Templates Wizard + Detail Redesign — Design

**Date:** 2026-05-17
**Repo:** HaiWeb
**Surfaces:** `/account/sonar/templates/new`, `/account/sonar/templates/[id]`
**Status:** Approved (brainstorming → spec)

## Problem

The templates detail page (`/account/sonar/templates/[id]`) renders only the
mutable fields of a `RunTemplate` — name, cadence, enabled, retention. The
**scope** (modality, counterparties, signal types, SKUs, depth limit,
authorization basis, provenance key, hop budget) is frozen at creation and
rendered **nowhere** on the page, so a user editing a configuration cannot see
what it actually targets. The creation form is a single flat form with no
structure or guidance.

Goal: surface the read-only scope alongside the editable fields, and give both
the creation and detail surfaces a structured, card-based "wizard" presentation.

## Decisions (resolved during brainstorming)

1. **Surfaces in scope:** detail page **and** creation flow. The templates list
   page is out of scope.
2. **Detail edit model:** always-editable inline. Editable cards are live inputs
   from page load; a sticky save bar appears when the form is dirty. Scope is
   rendered read-only/muted and never becomes editable.
3. **Detail layout:** stepped rail — a left numbered rail
   (Identity → Scope → Schedule → Lifecycle → Run history). The Scope entry
   shows a lock glyph instead of a number; its card is visually muted.
4. **Creation wizard navigation:** single scrolling page with the same rail
   acting as progress + jump-to nav. One **Create** button; validation runs at
   the end (not gated step-by-step). Visually identical shell to the detail page.
5. **Pills:** signal types render via `<Pill>` (they have definitions through
   `SIGNAL_TYPE_LABELS`). Counterparties and SKUs render as plain inline tags —
   they are free-form identifiers with no definition, so a `<Pill>` tooltip
   would be meaningless. A short code comment documents this as a deliberate
   exception to the CLAUDE.md "all badges via `<Pill>`" rule.

## Component Architecture

The current `templates/_components/template-form.tsx` (281 lines) is a
create+edit monolith. It cannot cleanly grow a read-only scope renderer, so it
is decomposed:

```
templates/_components/
  step-rail.tsx          NEW  shared left rail: ordered steps with
                              active / done / locked / error states + jump-to.
  step-card.tsx          NEW  card chrome — number-or-lock badge, title,
                              variants: default | locked (muted/dashed) | dim.
  scope-summary.tsx      NEW  read-only scope renderer. Three branches
                              (audit / watcher / phantom_demand) mirroring the
                              shape logic in scope-picker.tsx. Signal types via
                              <Pill>; counterparties/SKUs as plain tags.
  template-wizard.tsx    NEW  'new' page client shell: rail + Identity / Scope /
                              Schedule / Lifecycle step-cards + single Create.
                              End-of-form validation.
  template-editor.tsx    NEW  detail page client shell: rail + Identity /
                              Schedule / Lifecycle live cards + ScopeSummary
                              card + sticky save bar + Delete.
  template-form.tsx      KEPT thinned to shared field fragments (name input,
                              cadence wrapper, lifecycle fields) consumed by
                              both shells. No longer owns page layout or the
                              create-vs-edit branch.
```

Reused unchanged inside the wizard's Scope step: `cadence-picker.tsx`,
`scope-picker.tsx`, `counterparty-picker.tsx`, `partner-sku-picker.tsx`,
`phantom-demand-scope-fields.tsx`.

Server components `new/page.tsx` and `[id]/page.tsx` keep their existing
server-side fetch (`loadTemplate`, cookie/host forwarding) and simply render the
new client shells instead of `<TemplateForm>`.

## Step Model

| Step | Wizard (new) | Detail (`[id]`) |
|------|--------------|-----------------|
| Identity | name input + modality picker | name input (live) + modality shown locked |
| Scope | modality-specific `ScopePicker` (editable) | `ScopeSummary` (read-only, locked card) |
| Schedule | `CadencePicker` | `CadencePicker` (live) |
| Lifecycle | enabled + retention inputs | enabled + retention (live) |
| Review/History | — (single Create button at end) | `TemplateRunHistory` (existing component) |

## Data Flow

Unchanged from current behavior. No protocol or API change, no new endpoints.

- Wizard: `POST /api/account/sonar/templates` → on success `router.push` to the
  new `template_id` detail page (existing logic, preserved).
- Editor: `PATCH /api/account/sonar/templates/{id}` with
  `{ template_name, cadence, enabled, retention_days }` only (scope is never in
  the PATCH body — matches current contract). `DELETE` for removal.
- `ScopeSummary` is pure presentation derived from the already-fetched
  `RunTemplate.scope` discriminated union.

## Validation & Error Handling

- **Wizard (validate-at-end):** preserve the existing rules — `template_name`
  non-empty, and the existing `pdIncomplete` rule (phantom_demand requires
  counterparty + at least one SKU). On Create with invalid input, mark the
  offending step(s) with the rail's `error` state and scroll to the first
  invalid step. No network call until valid.
- **Editor:** Save gated on non-empty name (matches current behavior). Reuse the
  existing `describeApiError` / `FormError` / `sessionExpired` handling and the
  delete `confirm()` flow verbatim — no change to error semantics.
- Network failure messaging reuses the current copy.

## Testing

Vitest component tests (jsdom, existing harness):

- `scope-summary.test.tsx` — all three modality branches render their fields;
  empty `counterparties` / `skus` / `signal_types` arrays render an explicit
  empty state rather than blank; key_scoped audit shows provenance key, not
  counterparties.
- `step-rail.test.tsx` — active / done / locked / error state rendering and
  jump-to invocation.
- `template-wizard.test.tsx` — end-of-form validation surfaces step errors and
  blocks the POST; successful create routes to the new id.
- `template-editor.test.tsx` — clean load shows no save bar; editing a field
  reveals the sticky save bar; scope card exposes no inputs; delete confirm
  flow intact.
- Update existing `template-form` and page tests (`new/__tests__/page.test.tsx`,
  `[id]/__tests__/page.test.tsx`, `_components/__tests__/template-form.test.tsx`)
  to the new structure.

Gates: `npm run build` (tsc, strict) and `npm run lint` must stay green —
vitest passing alone is insufficient (tsc can fail while vitest passes).

## Brand & Accessibility

- Colors: Deep Navy `#1A1F36`, Orange `#F58220`, Teal `#29B0C3`. Headlines in
  Space Grotesk, body in DM Sans (existing tokens).
- Locked scope card: muted background, dashed border, lock glyph + "Fixed at
  creation" affordance with an accessible label.
- Rail steps are buttons with `aria-current` on the active step; locked step
  announces its locked state. WCAG 2.1 AA contrast retained.

## Out of Scope

- Templates list page styling.
- Any change to scope mutability (scope remains immutable post-creation).
- Protocol, BFF route, or haiCore changes.
- Gated step-by-step wizard validation (explicitly rejected in favor of
  validate-at-end).
