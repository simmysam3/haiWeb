# Config Page Width + Scope-Picker Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the five step-rail config bodies from 672px to 896px, indent product leaf rows one visual tab under their class row, and move the readiness ask inputs (qty / target window / predicted date) onto their own line beneath the product.

**Architecture:** Pure presentation changes in haiWeb. One Tailwind class swap per wizard surface; a left inset plus a new optional `detailSlot` prop on the shared `AccordionLeafRow`; the bilateral scope picker moves its ask cluster from the row's meta slot into that detail slot and gains visible labels. No data-flow, protocol, or API changes.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-22-config-page-width-and-picker-layout-design.md`

## Global Constraints

- Repo: `/Users/samfleming/dev/hw/haiWeb`, branch `v1.60`. All paths below are relative to the repo root.
- TDD for structural changes; pure Tailwind class changes (widths, padding) are NOT pinned in jsdom tests — they get a live browser check at the end.
- Do not change: ask emission rules (`sku_asks` only when both quantity and target_days are positive), `previewTargetDate`, any `aria-label` values (existing tests select by them), the audit picker's behavior (`collectAsks` stays default-false).
- Existing suites that must stay green: `src/components/grouped-accordion/__tests__/`, `src/app/account/sonar/watchers/new/_components/__tests__/`, `src/app/account/sonar/_components/__tests__/`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Widen the five step-rail config bodies

**Files:**
- Modify: `src/app/account/sonar/watchers/new/_components/watcher-wizard.tsx:177`
- Modify: `src/app/account/sonar/audit/new/_components/audit-wizard.tsx:276`
- Modify: `src/app/account/sonar/_components/definition-editor.tsx:341`
- Modify: `src/app/account/sonar/templates/_components/template-wizard.tsx:161`
- Modify: `src/app/account/sonar/templates/_components/template-editor.tsx:128`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks depend on (independent of Tasks 2–3).

This is a styling-only task (no behavior change) — per the spec it carries no new jsdom test; the gate is that the existing suites still pass and the class swap is verified live in Task 4.

- [ ] **Step 1: Swap the width class in all five files**

In each file, the change is exactly one class token, `max-w-2xl` → `max-w-4xl`, on the body `div` that sits next to `<StepRail>`.

`watcher-wizard.tsx` line 177:
```tsx
// before
      <div className="flex-1 max-w-2xl space-y-4">
// after
      <div className="flex-1 max-w-4xl space-y-4">
```

`audit-wizard.tsx` line 276, `definition-editor.tsx` line 341, `template-wizard.tsx` line 161, `template-editor.tsx` line 128 (identical in all four):
```tsx
// before
      <div className="flex-1 max-w-2xl">
// after
      <div className="flex-1 max-w-4xl">
```

- [ ] **Step 2: Confirm no other `max-w-2xl` was touched and existing tests pass**

Run:
```bash
cd /Users/samfleming/dev/hw/haiWeb
git diff --stat   # expect exactly 5 files, 1 line each
npx vitest run src/app/account/sonar/watchers/new src/app/account/sonar/_components src/app/account/sonar/templates src/app/account/sonar/audit
```
Expected: all listed suites PASS (no test asserts on the width class).

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat: widen step-rail config bodies to max-w-4xl

The five step-rail surfaces (watcher wizard, audit wizard, definition
editor, template wizard, template editor) capped their body at 672px,
which over-compressed the nested scope pickers.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: AccordionLeafRow — leaf inset + `detailSlot`

**Files:**
- Modify: `src/components/grouped-accordion/accordion-leaf-row.tsx`
- Test: `src/components/grouped-accordion/__tests__/accordion-leaf-row.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `AccordionLeafRow` accepts a new optional prop `detailSlot?: ReactNode`. When non-null it renders on its own block line beneath the row, indented under the label (`pl-12`), OUTSIDE the clickable/treeitem row element. Task 3 passes the ask cluster here. Both row variants also gain a `pl-6` left inset (the indentation fix).

- [ ] **Step 1: Write the failing tests**

Append to the existing `describe('<AccordionLeafRow>', ...)` block in `src/components/grouped-accordion/__tests__/accordion-leaf-row.test.tsx`:

```tsx
  it('renders detailSlot content on its own line beneath the row, not inside it', () => {
    render(
      <AccordionLeafRow
        label="Leaf"
        metaSlot={<span>SKU-1</span>}
        detailSlot={<span>ask cluster</span>}
      />,
    );
    const detail = screen.getByText('ask cluster');
    expect(detail).toBeInTheDocument();
    // The detail line is a sibling of the treeitem row, not part of its flex line.
    const row = screen.getByText('Leaf').closest('[role="treeitem"]');
    expect(row).not.toBeNull();
    expect(row).not.toContainElement(detail);
  });

  it('clicking detailSlot content does not activate a clickable row', () => {
    const onClick = vi.fn();
    render(
      <AccordionLeafRow
        label="Leaf"
        onClick={onClick}
        metaSlot={<span>m</span>}
        detailSlot={<button type="button">inner control</button>}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'inner control' }));
    expect(onClick).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd /Users/samfleming/dev/hw/haiWeb
npx vitest run src/components/grouped-accordion/__tests__/accordion-leaf-row.test.tsx
```
Expected: the two new tests FAIL — `detailSlot` is not a prop yet, so "ask cluster" / "inner control" are never rendered (TS may also reject the unknown prop). The three pre-existing tests still pass.

- [ ] **Step 3: Implement `detailSlot` + the `pl-6` leaf inset**

Replace the full contents of `src/components/grouped-accordion/accordion-leaf-row.tsx` with:

```tsx
'use client';

import type { ReactNode } from 'react';

interface Props {
  controlSlot?: ReactNode;
  label: ReactNode;
  metaSlot: ReactNode;
  onClick?: () => void;
  detailSlot?: ReactNode;
}

/**
 * Leaf row inside an accordion group. With `onClick`, the entire row is a
 * button (clickable; hover affordance). Without, it's a plain div — useful
 * for picker consumers that only care about the controlSlot's checkbox.
 *
 * `metaSlot` is right-aligned via ml-auto. Inside it, place small chips,
 * monospace identifiers, the row-detail affordance (`<DetailChevron />`
 * from components/sonar/observations — never a bare `›`/`→` glyph), etc.
 *
 * `detailSlot` renders on its own line beneath the row, indented under the
 * label. It is a SIBLING of the row element, not a child: detail content
 * routinely carries inputs, and nesting those inside the clickable treeitem
 * would make row activation swallow their clicks.
 *
 * The pl-6 inset on both variants keeps the leaf one visual tab deeper than
 * its parent group row's label (whose chevron + checkbox push it right).
 */
export function AccordionLeafRow({ controlSlot, label, metaSlot, onClick, detailSlot }: Props) {
  const labelText = typeof label === 'string' ? label : '';
  const content = (
    <>
      {controlSlot}
      <span className="truncate text-sm text-charcoal">{label}</span>
      <span className="ml-auto flex items-center gap-2">{metaSlot}</span>
    </>
  );
  const detail =
    detailSlot != null ? <div className="pl-12 pr-3 pb-1">{detailSlot}</div> : null;
  if (onClick) {
    return (
      <>
        {/* NOT a <button>: metaSlot routinely carries real buttons (IdChip,
            etc.) and a button-in-button is invalid HTML that React 19 rejects
            with a hydration error. Per the ARIA tree pattern the treeitem node
            itself is the focusable, activatable element. */}
        <div
          role="treeitem"
          aria-level={2}
          aria-label={labelText || undefined}
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
          // pr-3 keeps the right-aligned chevron / meta from sitting flush
          // against the row's right edge — matches the breathing room of
          // text-right table cells like run-exceptions-panel.tsx.
          className="group flex w-full items-center gap-2 py-0.5 pl-6 pr-3 text-left hover:bg-gray-50 cursor-pointer"
        >
          {content}
        </div>
        {detail}
      </>
    );
  }
  return (
    <>
      <div role="treeitem" aria-level={2} className="flex items-center gap-2 py-0.5 pl-6 pr-3">
        {content}
      </div>
      {detail}
    </>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run src/components/grouped-accordion/__tests__/
```
Expected: ALL PASS (5 tests in accordion-leaf-row + the grouped-accordion suite).

- [ ] **Step 5: Commit**

```bash
git add src/components/grouped-accordion/accordion-leaf-row.tsx src/components/grouped-accordion/__tests__/accordion-leaf-row.test.tsx
git commit -m "feat: indent accordion leaf rows and add detailSlot line

Leaf labels previously sat ~4px LEFT of their parent group label (the
group row's chevron + checkbox push its label right), so the hierarchy
did not read. pl-6 puts leaves one clear tab deeper. detailSlot gives
consumers a second line under the row for wide content like the
readiness ask inputs.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Move the ask cluster to the detail line with visible labels

**Files:**
- Modify: `src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx`
- Test: `src/app/account/sonar/watchers/new/_components/__tests__/watcher-scope-picker.test.tsx`

**Interfaces:**
- Consumes: `AccordionLeafRow`'s `detailSlot?: ReactNode` prop from Task 2.
- Produces: nothing new outward — `BilateralCounterpartiesSkusFields`' props and the emitted `{ counterparties, skus, sku_asks }` shape are unchanged. Audit picker (`collectAsks` false) renders identically to before apart from Task 2's inset.

- [ ] **Step 1: Write the failing test**

Append to the `describe('<WatcherScopePicker>', ...)` block in `src/app/account/sonar/watchers/new/_components/__tests__/watcher-scope-picker.test.tsx` (the file's existing `stubCatalogFetch` helper and `empty` scope are reused):

```tsx
  // v1.60 layout: the ask cluster moved out of the row's right-aligned meta
  // slot onto its own detail line beneath the product, with visible labels —
  // the meta slot could not fit the boxes plus the predicted-date preview.
  it('renders ask inputs with visible labels on a detail line under the selected SKU', async () => {
    stubCatalogFetch();

    const scope: WatcherScope = {
      ...empty,
      skus: ['PN-88A'],
      sku_asks: [{ sku: 'PN-88A', ask_quantity: 40, target_days: 30 }],
    };
    render(<WatcherScopePicker value={scope} onChange={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: /expand acme/i }));
    await userEvent.click(await screen.findByRole('button', { name: /expand unclassified/i }));

    // Visible labels (not just placeholders/aria-labels).
    const qtyLabel = await screen.findByText('Qty');
    expect(screen.getByText('Target window')).toBeInTheDocument();
    // The predicted-date preview renders (target_days is set).
    expect(screen.getByText(/if run today/)).toBeInTheDocument();
    // The cluster lives on the detail line, outside the row's flex line.
    const row = screen.getByText('Widget PN-88A').closest('[role="treeitem"]');
    expect(row).not.toBeNull();
    expect(row).not.toContainElement(qtyLabel);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd /Users/samfleming/dev/hw/haiWeb
npx vitest run src/app/account/sonar/watchers/new/_components/__tests__/watcher-scope-picker.test.tsx
```
Expected: the new test FAILS — no visible `Qty` / `Target window` text exists (current inputs are placeholder-only, inside the row's meta slot). All pre-existing tests still pass.

- [ ] **Step 3: Implement the move**

Three edits in `src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx`.

**(a)** Replace the whole `askInputs` function (currently lines ~307–351) with:

```tsx
  // Inline forward-demand ask inputs — rendered only for readiness watchers
  // (collectAsks) at a currently-selected SKU. Null everywhere else so the
  // shared audit picker is unchanged. Rendered on the leaf row's detail line
  // (AccordionLeafRow detailSlot), which has room for visible labels and the
  // full predicted-date preview.
  function askInputs(sku: string) {
    if (!collectAsks || !selectedSkus.has(sku)) return null;
    const draft = asks.get(sku);
    const qtyValue = draft && Number.isFinite(draft.ask_quantity) ? String(draft.ask_quantity) : '';
    const daysValue = draft && Number.isFinite(draft.target_days) ? String(draft.target_days) : '';
    // "if run today" preview so the rolling window reads as a concrete date
    // without pinning the stored value to one — the ask stays run_date + N days.
    const preview = draft && Number.isFinite(draft.target_days) && draft.target_days > 0
      ? previewTargetDate(draft.target_days)
      : null;
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate">
        <label className="flex items-center gap-1.5">
          <span>Qty</span>
          <input
            type="number"
            min={1}
            aria-label={`Ask quantity for ${sku}`}
            value={qtyValue}
            onChange={(e) => updateAsk(sku, { ask_quantity: Number.parseInt(e.target.value, 10) })}
            className="w-16 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span>Target window</span>
          <input
            type="number"
            min={1}
            required
            aria-label={`Target window in calendar days for ${sku}`}
            value={daysValue}
            onChange={(e) => updateAsk(sku, { target_days: Number.parseInt(e.target.value, 10) })}
            className="w-14 rounded border border-slate-300 px-1.5 py-0.5 text-xs"
          />
          <span>calendar days</span>
        </label>
        {preview && (
          <span className="whitespace-nowrap" aria-hidden>
            → ~{preview} if run today
          </span>
        )}
      </span>
    );
  }
```

(The `placeholder="qty"` / `placeholder="days"` attributes are dropped — the visible labels replace them. The `aria-label`s are unchanged.)

**(b)** In the products map (currently lines ~475–495), move the ask cluster from `metaSlot` to `detailSlot`:

```tsx
                          {products.map((p) => (
                            <AccordionLeafRow
                              key={p.external_product_id}
                              controlSlot={
                                <input
                                  type="checkbox"
                                  checked={selectedSkus.has(p.external_product_id)}
                                  onChange={() => toggleSku(p.external_product_id)}
                                />
                              }
                              label={p.product_name ?? '(unnamed product)'}
                              metaSlot={
                                <span className="text-xs font-mono text-slate truncate">
                                  {p.external_product_id}
                                </span>
                              }
                              detailSlot={askInputs(p.external_product_id)}
                            />
                          ))}
```

**(c)** In the orphan-SKU section (currently lines ~508–520), give the ask cluster the same second-line treatment:

```tsx
                      <div className="pl-4 mt-1 space-y-0.5">
                        {catalog.orphanIds.map((id) => {
                          const ask = askInputs(id);
                          return (
                            <div key={id}>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedSkus.has(id)}
                                  onChange={() => toggleSku(id)}
                                />
                                <span className="font-mono text-slate truncate">{id}</span>
                              </label>
                              {ask && <div className="pl-6 pt-0.5">{ask}</div>}
                            </div>
                          );
                        })}
                      </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npx vitest run src/app/account/sonar/watchers/new/_components/__tests__/ src/app/account/sonar/_components/__tests__/bilateral-counterparties-skus-fields.test.tsx
```
Expected: ALL PASS — the new layout test plus every pre-existing ask-emission / hydration / blank-window test (they select inputs by unchanged `aria-label`s).

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/_components/bilateral-counterparties-skus-fields.tsx src/app/account/sonar/watchers/new/_components/__tests__/watcher-scope-picker.test.tsx
git commit -m "feat: readiness ask inputs get their own line under the product

The qty / target-window / predicted-date cluster was squeezed into the
leaf row's right-aligned meta slot and clipped inside the (formerly
672px) wizard body. It now renders on the row's detail line with
visible labels; the meta slot keeps just the SKU id. Emission rules
and aria-labels unchanged; audit picker untouched (collectAsks false).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Full verification (suite + tsc + live browser)

**Files:** none (verification only).

**Interfaces:**
- Consumes: all prior tasks' commits on `v1.60`.
- Produces: green full suite + build, and a live visual confirmation.

- [ ] **Step 1: Run the full haiWeb test suite**

Run:
```bash
cd /Users/samfleming/dev/hw/haiWeb
npx vitest run
```
Expected: ALL PASS (no unrelated regressions from the shared accordion change — provenance browse and audit wizard suites included).

- [ ] **Step 2: Run the production build (tsc gate)**

vitest can pass while tsc fails — always run the build.

Run:
```bash
npm run build
```
Expected: build completes with no type errors.

- [ ] **Step 3: Live visual check**

With the local stack up (haiWeb dev server on :3001; start with `npm run dev` if it isn't running), load:

1. `http://localhost:3001/account/sonar/watchers/new` — body is visibly wider (896px); expanding a counterparty → class shows products indented one clear tab under the class label; checking a product reveals the `Qty … Target window … calendar days → ~<date> if run today` line fully rendered beneath it, nothing clipped.
2. `http://localhost:3001/account/sonar/audit/new` — same width + indentation, NO ask inputs anywhere.

If the stack or login isn't available, stop and hand the visual check to the user rather than skipping it.
