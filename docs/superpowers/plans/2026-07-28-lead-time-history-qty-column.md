# Lead-time history: per-run qty column + header-row rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the ask quantity a per-run column on the readiness watcher's lead-time history table, and replace the pill-based column headers with a grouped header row.

**Architecture:** The per-run quantity already exists on `SoftQuotedLeadTimePayload.ask_quantity`; `pivot-readiness.ts` folds it onto each row and the table renders it as a column, replacing a single config-derived header pill that mislabels historical rows. The tooltip behaviour currently embedded in `<Pill>` is extracted into a shared `<DefinitionTip>` so a new `<ColumnHeader>` can carry the same definitions without pill chrome.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind v4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-27-lead-time-history-qty-column-design.md`

**Branch:** `qty-column-header`, based on `pd-obligations-redaction` (`9917dfc`). PR stacks on haiWeb #140.

## Global Constraints

- **haiWeb only.** No change to `@haiwave/protocol`, haiCore, or any migration.
- **No `any` types.** Use `unknown` and narrow.
- **`kebab-case.tsx`** for all new file names.
- **Pills:** every pill/status badge still renders via `components/pill.tsx`. `<ColumnHeader>` is not a pill — it must not use `rounded-full`.
- **`<Pill>`'s rendered DOM and className output must not change.** Its 14 existing tests assert on `data-testid="pill"` and on exact class substrings (`text-teal-dark`, `text-warning`).
- **Run `npx tsc --noEmit` separately from `npm run build`** — Next's build does not type-check `.test.tsx`.
- **Always pass explicit test file paths to vitest.** Its positional filter is a substring match that descends into `.claude/worktrees/*` stale copies and produces phantom failures.
- Column order is fixed: `Run date · Published · Calibrated · Soft-quoted · Qty · Available capacity`.

## File Structure

**Create:**
- `src/components/definition-tip.tsx` — tooltip behaviour (state, `aria-describedby`, Escape, sr-only fallback). Consumed by `Pill` and `ColumnHeader`.
- `src/components/column-header.tsx` — renders a complete `<th>` with an optional `ⓘ` definition affordance.
- `src/components/__tests__/definition-tip.test.tsx`
- `src/components/__tests__/column-header.test.tsx`

**Modify:**
- `src/components/pill.tsx` — export `definitionFor()`, delegate rendering to `<DefinitionTip>`, reword the `lead_time_col.ask_quantity` copy.
- `src/app/account/sonar/watchers/[id]/_components/lead-time-history-table.tsx` — qty column, grouped header, no pills, no `d` suffix.
- `src/app/account/sonar/watchers/[id]/_lib/pivot-readiness.ts` — fold per-run `ask_quantity`.
- `src/app/account/sonar/watchers/[id]/_components/readiness-report.tsx:42,78` — stop passing `askQuantity`.
- `src/app/account/sonar/watchers/[id]/_components/order-state-table.tsx` — `Ship delta` pill → `<ColumnHeader>`.
- `src/app/account/sonar/watchers/[id]/_lib/__tests__/pivot-readiness.test.ts`
- `src/app/account/sonar/watchers/[id]/_components/__tests__/lead-time-history-table.test.tsx`

---

### Task 1: Extract `<DefinitionTip>` and export `definitionFor()`

The tooltip lives inside `Pill` (`pill.tsx:439-505`) and `PILL_DEFINITIONS` is a private module const (`pill.tsx:5`). `ColumnHeader` needs both. Extract rather than duplicate so there is one a11y implementation.

`definitionFor()` is new public API and gets a test. The `<DefinitionTip>` extraction is a pure refactor with no behaviour change — per the repo's TDD rule that is an explicit no-new-test exception, and the 14 existing `pill.test.tsx` assertions are the guard.

**Files:**
- Create: `src/components/definition-tip.tsx`
- Create: `src/components/__tests__/definition-tip.test.tsx`
- Modify: `src/components/pill.tsx`

**Interfaces:**
- Produces: `DefinitionTip({ body: string, className?: string, testId?: string, children: ReactNode })` from `@/components/definition-tip`; `definitionFor(category: string, value: string): string | undefined` from `@/components/pill`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test for `definitionFor`**

Create `src/components/__tests__/definition-tip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DefinitionTip } from '../definition-tip';
import { definitionFor } from '../pill';

describe('definitionFor', () => {
  it('resolves copy from the embedded map', () => {
    expect(definitionFor('lead_time_col', 'published')).toContain('officially listed');
  });

  it('returns undefined for an unknown category or value', () => {
    expect(definitionFor('lead_time_col', 'nope')).toBeUndefined();
    expect(definitionFor('nope', 'published')).toBeUndefined();
  });
});

describe('<DefinitionTip>', () => {
  it('exposes the body via aria-describedby without rendering a visible tooltip', () => {
    render(
      <DefinitionTip body="Some definition." testId="tip">
        Label
      </DefinitionTip>,
    );

    const host = screen.getByTestId('tip');
    const describedby = host.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    expect(document.getElementById(describedby as string)).toHaveTextContent('Some definition.');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the tooltip on focus and hides it on Escape', async () => {
    const user = userEvent.setup();
    render(
      <DefinitionTip body="Some definition." testId="tip">
        Label
      </DefinitionTip>,
    );

    await user.tab();
    expect(screen.getByTestId('tip')).toHaveFocus();
    expect(screen.getByRole('tooltip')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders no tooltip machinery when body is empty', () => {
    render(
      <DefinitionTip body="" testId="tip">
        Label
      </DefinitionTip>,
    );

    expect(screen.getByTestId('tip')).not.toHaveAttribute('aria-describedby');
    expect(screen.getByText('Label')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/definition-tip.test.tsx`
Expected: FAIL — cannot resolve `../definition-tip`, and `definitionFor` is not exported from `../pill`.

- [ ] **Step 3: Create `definition-tip.tsx`**

The caller supplies **all** appearance and positioning classes. `DefinitionTip` adds none — that is what keeps `Pill`'s className output byte-identical. The caller's className must include `relative` so the absolutely-positioned tooltip anchors correctly.

```tsx
'use client';
import { useId, useState, type ReactNode } from 'react';

// Shared definition-tooltip behaviour: hover/focus/click to open, Escape to
// dismiss, aria-describedby wiring, and an sr-only fallback so the text is
// reachable while the visual tooltip is closed. Extracted from <Pill> so
// <ColumnHeader> can carry the same definitions without pill chrome.

interface DefinitionTipProps {
  /** Fully composed tooltip text. Empty string renders children with no tooltip. */
  body: string;
  /**
   * ALL appearance and positioning classes come from the caller — this component
   * adds none, so <Pill>'s rendered class string is unchanged by the extraction.
   * Must include `relative`: the tooltip is absolutely positioned against it.
   */
  className?: string;
  testId?: string;
  children: ReactNode;
}

export function DefinitionTip({ body, className = '', testId, children }: DefinitionTipProps) {
  const tipId = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      data-testid={testId}
      tabIndex={0}
      aria-describedby={body ? tipId : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      // If tooltip content ever becomes interactive (links/buttons), replace this
      // with a relatedTarget containment check so focus moving into the tooltip
      // doesn't dismiss it.
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
      onClick={() => setOpen((o) => !o)}
      className={className}
    >
      {children}
      {body && open && (
        <span
          role="tooltip"
          id={tipId}
          className="absolute left-0 top-full z-50 mt-1 w-max max-w-xs whitespace-pre-line rounded bg-navy px-2 py-1 text-xs font-normal text-white shadow-lg"
        >
          {body}
        </span>
      )}
      {body && !open && (
        <span id={tipId} className="sr-only">
          {body}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 4: Export `definitionFor` from `pill.tsx`**

Add immediately after the `PILL_DEFINITIONS` const closes (the record itself stays private):

```tsx
/** Resolve definition copy without exposing the map. Used by <ColumnHeader>. */
export function definitionFor(category: string, value: string): string | undefined {
  return PILL_DEFINITIONS[category]?.[value];
}
```

- [ ] **Step 5: Delegate `Pill`'s render to `<DefinitionTip>`**

Add the import at the top of `pill.tsx`:

```tsx
import { DefinitionTip } from './definition-tip';
```

Replace the `resolved` line so it routes through the new helper:

```tsx
  const resolved =
    definition ?? (category && value ? definitionFor(category, value) : undefined);
```

Replace the entire `return (...)` block of `Pill` (currently `pill.tsx:469-504`) with:

```tsx
  return (
    <DefinitionTip
      body={body}
      testId="pill"
      className={`relative inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-default ${appliedTone} ${className}`}
    >
      {label}
    </DefinitionTip>
  );
```

`useId` and `useState` are no longer used by `Pill`; remove them from its React import if nothing else in the file needs them.

- [ ] **Step 6: Run the new test and the full existing pill suites**

Run: `npx vitest run src/components/__tests__/definition-tip.test.tsx src/components/__tests__/pill.test.tsx src/components/__tests__/pill-signal-type.test.tsx`
Expected: PASS — all new tests green, and all 14 pre-existing pill tests still green with no snapshot or className drift.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/definition-tip.tsx src/components/__tests__/definition-tip.test.tsx src/components/pill.tsx
git commit -m "refactor(web): extract <DefinitionTip> from <Pill>, export definitionFor()"
```

---

### Task 2: `<ColumnHeader>`

Renders a complete `<th>`. Callers replace their whole `<th>…</th>` with it. The `ⓘ` appears only when a definition resolves, so headers without one (`Run date`, `PO`, `Qty` on the order tables) stay plain.

**Files:**
- Create: `src/components/column-header.tsx`
- Create: `src/components/__tests__/column-header.test.tsx`

**Interfaces:**
- Consumes: `DefinitionTip` and `definitionFor` from Task 1.
- Produces: `ColumnHeader({ label: string, category?: string, value?: string, definition?: string, className?: string })` from `@/components/column-header`.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/column-header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ColumnHeader } from '../column-header';

function renderHeader(ui: React.ReactNode) {
  return render(
    <table>
      <thead>
        <tr>{ui}</tr>
      </thead>
    </table>,
  );
}

describe('<ColumnHeader>', () => {
  it('renders a th element, not a nested span inside a caller th', () => {
    renderHeader(<ColumnHeader label="Run date" />);

    const cell = screen.getByText('Run date').closest('th');
    expect(cell).toBeInTheDocument();
  });

  it('renders no definition affordance when no definition resolves', () => {
    renderHeader(<ColumnHeader label="Run date" />);

    expect(screen.getByText('Run date')).toBeInTheDocument();
    expect(screen.queryByTestId('column-header-tip')).not.toBeInTheDocument();
  });

  it('resolves definition copy from category and value', () => {
    renderHeader(<ColumnHeader label="Published" category="lead_time_col" value="published" />);

    const tip = screen.getByTestId('column-header-tip');
    const describedby = tip.getAttribute('aria-describedby');
    expect(document.getElementById(describedby as string)).toHaveTextContent('officially listed');
  });

  it('is not a pill', () => {
    renderHeader(<ColumnHeader label="Published" category="lead_time_col" value="published" />);

    expect(screen.queryByTestId('pill')).not.toBeInTheDocument();
    expect(screen.getByTestId('column-header-tip').className).not.toContain('rounded-full');
  });

  it('accepts an explicit definition override', () => {
    renderHeader(<ColumnHeader label="Custom" definition="Explicit copy." />);

    const tip = screen.getByTestId('column-header-tip');
    const describedby = tip.getAttribute('aria-describedby');
    expect(document.getElementById(describedby as string)).toHaveTextContent('Explicit copy.');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/__tests__/column-header.test.tsx`
Expected: FAIL — cannot resolve `../column-header`.

- [ ] **Step 3: Create `column-header.tsx`**

```tsx
'use client';
import { DefinitionTip } from './definition-tip';
import { definitionFor } from './pill';

// Table column header carrying an optional definition tooltip. Replaces the
// former practice of using <Pill> as a <th> — pills read as status chrome
// rather than table structure. Renders the complete <th>: callers swap their
// entire <th>…</th> for this component.

interface ColumnHeaderProps {
  label: string;
  /** Resolves copy from the shared definition map alongside `value`. */
  category?: string;
  value?: string;
  /** Explicit definition; overrides the map. */
  definition?: string;
  /** Extra classes on the <th> (e.g. text-center, colSpan wrappers). */
  className?: string;
}

export function ColumnHeader({
  label,
  category,
  value,
  definition,
  className = '',
}: ColumnHeaderProps) {
  const resolved =
    definition ?? (category && value ? definitionFor(category, value) : undefined);

  return (
    <th className={`px-3 py-2 font-semibold ${className}`.trim()}>
      {resolved ? (
        <DefinitionTip
          body={resolved}
          testId="column-header-tip"
          className="relative inline-flex cursor-help items-center gap-0.5"
        >
          {label}
          <span aria-hidden className="text-[9px] leading-none text-slate-400">
            &#9432;
          </span>
        </DefinitionTip>
      ) : (
        label
      )}
    </th>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/__tests__/column-header.test.tsx`
Expected: PASS — all five tests green.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/column-header.tsx src/components/__tests__/column-header.test.tsx
git commit -m "feat(web): add <ColumnHeader> with definition tooltip"
```

---

### Task 3: Fold per-run `ask_quantity` in `pivot-readiness`

This is the data half of the correctness fix. `SoftQuotedLeadTimePayload.ask_quantity` is written at run time; the pivot currently discards it.

The existing fixture uses `ask_quantity: 40` on both runs and asserts nothing about it. Change the two payload values to 23 and 25 while leaving `skuAsks` at 40 — that mirrors the production bug exactly (config says 40, runs used 23 and 25) and proves the row value is not the config value.

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/_lib/pivot-readiness.ts`
- Modify: `src/app/account/sonar/watchers/[id]/_components/lead-time-history-table.tsx` (type only)
- Test: `src/app/account/sonar/watchers/[id]/_lib/__tests__/pivot-readiness.test.ts`
- Test: `src/app/account/sonar/watchers/[id]/_components/__tests__/readiness-report.test.tsx` (fixture only — see Step 5)

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces: `LeadTimeHistoryRow.ask_quantity: number | null` — Task 4 renders it.

- [ ] **Step 1: Write the failing test**

In `pivot-readiness.test.ts`, change the older run's soft-quote `ask_quantity: 40` to `ask_quantity: 23`, and the newer run's `ask_quantity: 40` to `ask_quantity: 25`. Leave `skuAsks` at `ask_quantity: 40`.

Then add these assertions inside the existing `it('folds two runs of one SKU/vendor into a single readiness entry')`, after the existing `newest`/`older` blocks:

```ts
    // Per-run quantity, NOT the current config value. skuAsks says 40; these
    // runs executed at 25 and 23. Regression guard: a single config-derived
    // scalar would label both rows 40.
    expect(newest.ask_quantity).toBe(25);
    expect(older.ask_quantity).toBe(23);
```

Add a second test to the `describe('pivotReadiness')` block:

```ts
  it('leaves ask_quantity null for a run with no soft-quote result', () => {
    const runsOnly: RunRef[] = [{ run_id: RUN_NEW, triggered_at: '2026-06-15T00:00:00Z' }];
    const published = results.filter(
      (r) => r.run_id === RUN_NEW && r.signal_type === 'published_lead_time',
    );

    const skus = pivotReadiness(published, runsOnly, skuAsks);

    const row = skus[0].vendors[0].lead_time_rows[0];
    expect(row.published).toBe(20);
    expect(row.ask_quantity).toBeNull();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run 'src/app/account/sonar/watchers/[id]/_lib/__tests__/pivot-readiness.test.ts'`
Expected: FAIL — `ask_quantity` does not exist on `LeadTimeHistoryRow`.

- [ ] **Step 3: Add the field to the row type**

In `lead-time-history-table.tsx`, add to the `LeadTimeHistoryRow` interface after `soft_quoted_unavailable`:

```ts
  /** Quantity this run resolved the soft quote for. Null when the run had no
   *  soft-quote result. Per-run, NOT the current configured ask. */
  ask_quantity: number | null;
```

- [ ] **Step 4: Fold the value in `pivot-readiness.ts`**

In `emptyRow()`, add the seed:

```ts
    ask_quantity: null,
```

In `foldSignalIntoRow()`, extend the existing `soft_quoted_lead_time` case:

```ts
    case 'soft_quoted_lead_time': {
      const soft = payload as SoftQuotedLeadTimePayload;
      row.soft_quoted = soft.days;
      row.soft_quoted_unavailable = soft.availability === 'unavailable';
      row.ask_quantity = soft.ask_quantity;
      break;
    }
```

- [ ] **Step 5: Repair the `readiness-report` fixture**

`ask_quantity` is a required field, so every existing `LeadTimeHistoryRow` literal must supply it. `readiness-report.test.tsx` builds one at lines 22-28 and will fail `tsc` without this.

In `src/app/account/sonar/watchers/[id]/_components/__tests__/readiness-report.test.tsx`, add `ask_quantity` to the row object inside `lead_time_rows` (the one that already sets `soft_quoted: 34`):

```ts
          ask_quantity: 40,
```

If that file contains more than one row literal, add the field to each. Then confirm no other literal exists anywhere:

```bash
grep -rn "soft_quoted_unavailable" src/ --include='*.tsx' --include='*.ts'
```

Every hit must be a row literal that now sets `ask_quantity`, the interface definition, or the `pivot-readiness.ts` fold.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run 'src/app/account/sonar/watchers/[id]/_lib/__tests__/pivot-readiness.test.ts' 'src/app/account/sonar/watchers/[id]/_components/__tests__/readiness-report.test.tsx'`
Expected: PASS — both files green.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. This is the step that catches any row literal still missing `ask_quantity` — `npm run build` would not, because it does not type-check `.test.tsx`.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/account/sonar/watchers/[id]/_lib/pivot-readiness.ts' 'src/app/account/sonar/watchers/[id]/_components/lead-time-history-table.tsx' 'src/app/account/sonar/watchers/[id]/_lib/__tests__/pivot-readiness.test.ts' 'src/app/account/sonar/watchers/[id]/_components/__tests__/readiness-report.test.tsx'
git commit -m "fix(web): carry per-run ask_quantity onto lead-time history rows"
```

---

### Task 4: Rebuild the lead-time history table

The visible half: Qty column, grouped two-tier header, no pills, no `d` suffix. Also reword the `ask_quantity` definition — it currently describes a forward-looking config value, which stops being true once the column is historical.

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/_components/lead-time-history-table.tsx`
- Modify: `src/app/account/sonar/watchers/[id]/_components/readiness-report.tsx`
- Modify: `src/components/pill.tsx` (copy only)
- Test: `src/app/account/sonar/watchers/[id]/_components/__tests__/lead-time-history-table.test.tsx`

**Interfaces:**
- Consumes: `ColumnHeader` (Task 2); `LeadTimeHistoryRow.ask_quantity` (Task 3).
- Produces: `LeadTimeHistoryTable({ rows: LeadTimeHistoryRow[] })` — the `askQuantity` prop is gone.

- [ ] **Step 1: Rewrite the test file**

Replace the whole of `lead-time-history-table.test.tsx`. The mixed-quantity fixture (25 over 23) is the regression guard for the production bug.

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LeadTimeHistoryTable, type LeadTimeHistoryRow } from '../lead-time-history-table';

describe('<LeadTimeHistoryTable>', () => {
  // Newest first. Mirrors the production case: the ask was edited from 23 to 25,
  // so the newest run resolved at 25 and the older runs at 23.
  const rows: LeadTimeHistoryRow[] = [
    {
      run_date: '2026-06-15T00:00:00Z',
      published: 20,
      calibrated: 12,
      soft_quoted: 34,
      soft_quoted_unavailable: false,
      ask_quantity: 25,
      capacity: 'moderate',
    },
    {
      run_date: '2026-06-08T00:00:00Z',
      published: 21,
      calibrated: 13,
      soft_quoted: 31,
      soft_quoted_unavailable: true,
      ask_quantity: 23,
      capacity: 'low',
    },
    {
      run_date: '2026-06-01T00:00:00Z',
      published: 22,
      calibrated: 14,
      soft_quoted: 30,
      soft_quoted_unavailable: false,
      ask_quantity: null,
      capacity: 'high',
    },
  ];

  it('renders no pills in the header', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.queryAllByTestId('pill')).toHaveLength(0);
  });

  it('renders the six column headers plus the lead-time group label', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.getByText('Run date')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Calibrated')).toBeInTheDocument();
    expect(screen.getByText('Soft-quoted')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
    expect(screen.getByText('Available capacity')).toBeInTheDocument();
    expect(screen.getByText('Lead time (days)')).toBeInTheDocument();
  });

  it('shows each run its own quantity rather than one shared value', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    const cells = screen.getAllByTestId('qty-cell');
    expect(cells.map((c) => c.textContent)).toEqual(['25', '23', '—']);
  });

  it('keeps definition tooltips on the defined columns and none on Run date', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    // published, calibrated, soft_quoted, ask_quantity, capacity — five defined
    // columns. Run date has no definition and so no affordance.
    expect(screen.getAllByTestId('column-header-tip')).toHaveLength(5);
  });

  it('renders lead-time values without a d suffix now the unit is in the group header', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.getByText('34')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.queryByText('34d')).not.toBeInTheDocument();
  });

  it('shows an explicit "not available" cell for an unavailable soft quote', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    expect(screen.getByText(/not available/i)).toBeInTheDocument();
  });

  it('emphasizes the newest (row 0) run and not the older rows', () => {
    render(<LeadTimeHistoryTable rows={rows} />);

    const newestRow = screen.getByText('34').closest('tr');
    const olderRow = screen.getByText('30').closest('tr');

    expect(newestRow).toHaveClass('font-medium');
    expect(olderRow).not.toHaveClass('font-medium');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run 'src/app/account/sonar/watchers/[id]/_components/__tests__/lead-time-history-table.test.tsx'`
Expected: FAIL — pills still present, `Qty`/`Lead time (days)` not found, `qty-cell` missing, and `34d` still rendered.

- [ ] **Step 3: Rewrite the table body of `lead-time-history-table.tsx`**

Replace the `Pill` import with:

```tsx
import { ColumnHeader } from '@/components/column-header';
```

Replace `days()` so the unit lives in the group header:

```tsx
// The "Lead time (days)" group header carries the unit, so cells are bare
// numbers. Columns outside that group (e.g. ship delta) keep their own suffix.
function days(value: number | null): string {
  return value === null ? DASH : String(value);
}
```

Replace `Props` and the whole `<thead>`, and add the qty cell to `<tbody>`:

```tsx
interface Props {
  rows: LeadTimeHistoryRow[];
}

export function LeadTimeHistoryTable({ rows }: Props) {
  return (
    <section>
      <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
        Lead-time history
      </h4>
      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead>
            {/* Group tier: Published/Calibrated/Soft-quoted share a unit; Qty and
                capacity do not. A plain spanning th — a unit annotation, not a
                defined term, so no tooltip. */}
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-600">
              <th />
              <th
                colSpan={3}
                className="border-b border-slate-300 px-3 pb-1 pt-2 text-center font-bold text-teal"
              >
                Lead time (days)
              </th>
              <th />
              <th />
            </tr>
            <tr className="border-b-2 border-slate-300 bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
              <ColumnHeader label="Run date" />
              <ColumnHeader label="Published" category="lead_time_col" value="published" />
              <ColumnHeader label="Calibrated" category="lead_time_col" value="calibrated" />
              <ColumnHeader label="Soft-quoted" category="lead_time_col" value="soft_quoted" />
              <ColumnHeader label="Qty" category="lead_time_col" value="ask_quantity" />
              <ColumnHeader
                label="Available capacity"
                category="lead_time_col"
                value="capacity"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => {
              const latest = index === 0;
              return (
                <tr key={row.run_date} className={latest ? 'bg-teal/5 font-medium' : ''}>
                  <td className="px-3 py-2 text-charcoal">{formatDate(row.run_date)}</td>
                  <td className="px-3 py-2 font-mono">{days(row.published)}</td>
                  <td className="px-3 py-2 font-mono">{days(row.calibrated)}</td>
                  <td className="px-3 py-2 font-mono">
                    {row.soft_quoted_unavailable ? (
                      <span className="italic text-slate">not available</span>
                    ) : (
                      days(row.soft_quoted)
                    )}
                  </td>
                  <td data-testid="qty-cell" className="px-3 py-2 font-mono">
                    {row.ask_quantity === null ? DASH : row.ask_quantity}
                  </td>
                  <td className="px-3 py-2">
                    {row.capacity === null ? DASH : CAPACITY_LABEL[row.capacity]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Stop passing the removed prop**

In `readiness-report.tsx`, change line 42 to:

```tsx
          <LeadTimeHistoryTable rows={vendor.lead_time_rows} />
```

Remove `askQuantity` from `VendorBlockProps`, from the `VendorBlock` destructure, and delete the `askQuantity={sku.ask?.ask_quantity ?? 0}` prop on `<VendorBlock>` (line 78). Leave the SKU-level `Ask: … units within … calendar days` line at line 68 untouched — it correctly describes the current ask.

- [ ] **Step 5: Reword the `ask_quantity` definition**

In `pill.tsx`, replace the `lead_time_col.ask_quantity` entry:

```tsx
    ask_quantity: "Ask quantity: the forward-demand quantity this run resolved the soft quote for. Fixed at run time — editing the watcher's ask changes later runs, not this one.",
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run 'src/app/account/sonar/watchers/[id]/_components/__tests__/lead-time-history-table.test.tsx'`
Expected: PASS — all seven tests green.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. In particular `readiness-report.tsx` must not still pass `askQuantity`.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/account/sonar/watchers/[id]/_components/lead-time-history-table.tsx' 'src/app/account/sonar/watchers/[id]/_components/readiness-report.tsx' 'src/app/account/sonar/watchers/[id]/_components/__tests__/lead-time-history-table.test.tsx' src/components/pill.tsx
git commit -m "feat(web): per-run qty column + grouped header on lead-time history"
```

---

### Task 5: Convert the `Ship delta` header

`order-state-table.tsx:87-91` holds the page's only other pill-as-header. Leaving it would contradict the rule this change establishes. Its two tables keep single-tier headers — neither has a column group worth drawing.

**Files:**
- Modify: `src/app/account/sonar/watchers/[id]/_components/order-state-table.tsx`
- Test: `src/app/account/sonar/watchers/[id]/_components/__tests__/order-state-table.test.tsx`

**Interfaces:**
- Consumes: `ColumnHeader` (Task 2).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

`src/app/account/sonar/watchers/[id]/_components/__tests__/order-state-table.test.tsx` **already exists** with a `describe('<OrderStateTable>')` containing two tests. Do not recreate it — append these two `it` blocks inside that existing `describe`, and reuse whatever payload fixture the file already defines rather than adding a second one.

```tsx
  it('renders no pills in its headers', () => {
    render(<OrderStateTable payload={payload} />);

    expect(screen.queryAllByTestId('pill')).toHaveLength(0);
  });

  it('keeps the ship-delta definition on a column header affordance', () => {
    render(<OrderStateTable payload={payload} />);

    expect(screen.getByText('Ship delta')).toBeInTheDocument();
    const tips = screen.getAllByTestId('column-header-tip');
    expect(tips).toHaveLength(1);
    const describedby = tips[0].getAttribute('aria-describedby');
    expect(document.getElementById(describedby as string)).toHaveTextContent('fulfillment history');
  });
```

Substitute the file's existing fixture variable name for `payload` if it differs.

Note: the `+Nd` ship-delta chip in the table **body** is a hand-rolled `<span>` using `rounded` (not a `<Pill>`, not `rounded-full`), so the "no pills" assertion holds once the header pill is gone, and the existing `+2d delta chip` test keeps passing. Leave that chip alone — it is out of scope.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run 'src/app/account/sonar/watchers/[id]/_components/__tests__/order-state-table.test.tsx'`
Expected: FAIL — one pill is present and no `column-header-tip` exists.

- [ ] **Step 3: Convert the header**

Replace the `Pill` import in `order-state-table.tsx` with:

```tsx
import { ColumnHeader } from '@/components/column-header';
```

Replace the `Ship delta` header block (currently lines 87-91) with:

```tsx
                  <ColumnHeader
                    label="Ship delta"
                    category="lead_time_col"
                    value="calibrated"
                  />
```

Leave every other `<th>` in both tables as plain markup — they carry no definitions and converting them would add nothing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run 'src/app/account/sonar/watchers/[id]/_components/__tests__/order-state-table.test.tsx'`
Expected: PASS — both tests green.

- [ ] **Step 5: Full verification before the final commit**

Run each and confirm before claiming completion:

```bash
npx vitest run --exclude '**/.claude/**'
npx tsc --noEmit
npm run build
```

Expected: suite green with no new failures against the pre-change baseline; no type errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/account/sonar/watchers/[id]/_components/order-state-table.tsx' 'src/app/account/sonar/watchers/[id]/_components/__tests__/order-state-table.test.tsx'
git commit -m "refactor(web): ship-delta header uses <ColumnHeader>, not <Pill>"
```

---

## Manual verification

The unit tests cannot see layout. After Task 5, check the real page.

1. haiWeb on `:3001`, haiCore on `:3000`, Postgres on `:5433`.
2. Open `/account/sonar/watchers/f57a75b2-941f-42a0-8716-d6bf0b54c24e` and expand a vendor block.
3. Confirm in the Lead-time history table:
   - The newest row's **Qty** reads **25**; the rows beneath read **23**. This is the bug being fixed — before the change every row read 25.
   - `Lead time (days)` spans Published / Calibrated / Soft-quoted, with the rule beneath it.
   - No pill chrome in any header; hovering `Published`/`Calibrated`/`Soft-quoted`/`Qty`/`Available capacity` shows the definition; `Run date` shows none.
   - Lead-time cells read `30`, not `30d`.
   - The header row separates clearly from the first data row.
4. In the same block, confirm `Ship delta` is plain text with a working tooltip and no pill.
5. Confirm the SKU-level `Ask: 25 units within … calendar days` line still shows the current configured ask.
