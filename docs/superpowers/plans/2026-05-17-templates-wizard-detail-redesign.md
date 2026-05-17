# Templates Wizard + Detail Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface a `RunTemplate`'s read-only scope alongside its always-editable fields on the templates detail page, and turn the creation form into a single-page card wizard, both sharing one stepped-rail visual vocabulary.

**Architecture:** Decompose the `template-form.tsx` create+edit monolith into focused presentational pieces (`step-rail`, `step-card`, `scope-summary`) plus two client shells (`template-wizard` for `/new`, `template-editor` for `/[id]`). Server `page.tsx` files keep their existing data fetch and just render the new shells. No protocol, BFF, or haiCore changes — `ScopeSummary` is pure presentation off the already-fetched `RunTemplate.scope` discriminated union.

**Tech Stack:** Next.js 16 App Router, React client components, TypeScript strict, Tailwind v4 with HAIWAVE brand tokens, Vitest + @testing-library/react + @testing-library/user-event.

**Spec:** `docs/superpowers/specs/2026-05-17-templates-wizard-detail-redesign-design.md`

---

## File Structure

```
src/app/account/sonar/templates/
  _components/
    step-rail.tsx          NEW  vertical rail: ordered steps, states
                                (active|done|locked|error), jump-to onClick.
    step-card.tsx          NEW  card chrome: number-or-lock badge + title +
                                variant (default|locked|dim) + children.
    scope-summary.tsx      NEW  read-only scope renderer; audit/watcher/
                                phantom_demand branches. Signal types via
                                <Pill>; counterparties/SKUs via <IdChip>.
    template-wizard.tsx    NEW  '/new' client shell. Single scrolling page +
                                rail; Identity/Scope/Schedule/Lifecycle
                                step-cards; one Create, validate-at-end.
    template-editor.tsx    NEW  '/[id]' client shell. Rail + live Identity/
                                Schedule/Lifecycle cards + ScopeSummary card +
                                sticky save bar + Delete.
    template-form.tsx      MODIFY  thinned to shared field fragments
                                (NameField, LifecycleFields) used by both
                                shells. Loses page layout + create/edit branch.
  new/page.tsx             MODIFY  render <TemplateWizard> instead of
                                <TemplateForm>.
  [id]/page.tsx            MODIFY  render <TemplateEditor template={...}/>.
```

Reused unchanged: `cadence-picker.tsx`, `scope-picker.tsx`, `counterparty-picker.tsx`, `partner-sku-picker.tsx`, `phantom-demand-scope-fields.tsx`, `_lib/format-cadence.ts`, `_lib/config-noun.ts`, `_lib/system-config.ts`, `[id]/_components/manual-trigger-button.tsx`, `[id]/_components/template-run-history.tsx`.

Key existing primitives to reuse (do NOT recreate): `@/components` exports `Pill`, `IdChip`, `FormError`; `@/lib/api-error` exports `describeApiError`; `@/lib/signal-type-labels` exports `SIGNAL_TYPE_LABELS`.

`RunTemplate` shape (from `@haiwave/protocol`): `template_id`, `template_name`, `observation_class` (`'audit'|'watcher'|'phantom_demand'`), `cadence`, `enabled`, `retention_days`, `created_at`, `last_run_at` (nullable), and a `scope` discriminated on `kind`:
- audit bilateral: `{ kind:'audit', authorization_basis:'bilateral', counterparties:string[], signal_types:SignalType[], skus:string[], depth_limit:number, hop_budget:number }`
- audit key_scoped: `{ kind:'audit', authorization_basis:'key_scoped', provenance_key_id:string, depth_limit:number, hop_budget:number }`
- watcher: `{ kind:'watcher', authorization_basis:'bilateral', counterparties:string[], signal_types:SignalType[], depth_limit:number }`
- phantom_demand: `{ kind:'phantom_demand', authorization_basis:'bilateral', counterparty:string, skus:string[], hypothetical_quantity:number, hypothetical_timeline:string|null }`

---

## Task 1: ScopeSummary read-only renderer

**Files:**
- Create: `src/app/account/sonar/templates/_components/scope-summary.tsx`
- Test: `src/app/account/sonar/templates/_components/__tests__/scope-summary.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/account/sonar/templates/_components/__tests__/scope-summary.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RunTemplateScope } from '@haiwave/protocol';
import { ScopeSummary } from '../scope-summary';

describe('ScopeSummary', () => {
  it('audit bilateral: shows counterparties, signal-type pills, depth, auth', () => {
    const scope: RunTemplateScope = {
      kind: 'audit',
      authorization_basis: 'bilateral',
      counterparties: ['acme-corp'],
      signal_types: ['lead_time_distribution'],
      skus: ['SKU-1'],
      depth_limit: 2,
      hop_budget: 5,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText('Lead time distribution')).toBeInTheDocument();
    expect(screen.getByText('SKU-1')).toBeInTheDocument();
    expect(screen.getByText(/bilateral/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('audit key_scoped: shows the provenance key, not counterparties', () => {
    const scope: RunTemplateScope = {
      kind: 'audit',
      authorization_basis: 'key_scoped',
      provenance_key_id: 'key-123',
      depth_limit: 1,
      hop_budget: 5,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('key-123')).toBeInTheDocument();
    expect(screen.queryByText(/counterparties/i)).not.toBeInTheDocument();
  });

  it('watcher: lists signal types and depth', () => {
    const scope: RunTemplateScope = {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: ['capacity_utilization_band'],
      depth_limit: 3,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('Capacity utilization band')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('phantom_demand: shows counterparty, skus, quantity', () => {
    const scope: RunTemplateScope = {
      kind: 'phantom_demand',
      authorization_basis: 'bilateral',
      counterparty: 'globex',
      skus: ['SKU-9'],
      hypothetical_quantity: 100,
      hypothetical_timeline: null,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getByText('globex')).toBeInTheDocument();
    expect(screen.getByText('SKU-9')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders an explicit empty state for empty arrays', () => {
    const scope: RunTemplateScope = {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: [],
      depth_limit: 1,
    };
    render(<ScopeSummary scope={scope} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/scope-summary.test.tsx`
Expected: FAIL — `Failed to resolve import "../scope-summary"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/account/sonar/templates/_components/scope-summary.tsx
import type { RunTemplateScope } from '@haiwave/protocol';
import { Pill, IdChip } from '@/components';
import { SIGNAL_TYPE_LABELS } from '@/lib/signal-type-labels';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[11px] uppercase tracking-wide text-slate mb-1">
        {label}
      </div>
      <div className="text-sm text-charcoal flex flex-wrap gap-1.5 items-center">
        {children}
      </div>
    </div>
  );
}

const EMPTY = <span className="text-slate">—</span>;

// Counterparties and SKUs are free-form identifiers with no definition, so they
// render via <IdChip> (the established non-Pill identifier primitive) rather
// than <Pill>. Signal types DO have definitions and render via <Pill>. This is
// a deliberate, documented exception to the "all badges via <Pill>" rule.
function Ids({ ids }: { ids: string[] }) {
  if (ids.length === 0) return EMPTY;
  return (
    <>
      {ids.map((id) => (
        <IdChip key={id} id={id} chars={16} />
      ))}
    </>
  );
}

function Signals({ types }: { types: string[] }) {
  if (types.length === 0) return EMPTY;
  return (
    <>
      {types.map((t) => (
        <Pill
          key={t}
          category="signal_type"
          value={t}
          detail={SIGNAL_TYPE_LABELS[t as keyof typeof SIGNAL_TYPE_LABELS]?.tooltip}
        >
          {SIGNAL_TYPE_LABELS[t as keyof typeof SIGNAL_TYPE_LABELS]?.label ?? t}
        </Pill>
      ))}
    </>
  );
}

export function ScopeSummary({ scope }: { scope: RunTemplateScope }) {
  if (scope.kind === 'audit') {
    return (
      <div>
        <Field label="Authorization basis">{scope.authorization_basis}</Field>
        {scope.authorization_basis === 'key_scoped' ? (
          <Field label="Provenance key">
            <IdChip id={scope.provenance_key_id} chars={24} />
          </Field>
        ) : (
          <>
            <Field label="Counterparties">
              <Ids ids={scope.counterparties} />
            </Field>
            <Field label="Signal types">
              <Signals types={scope.signal_types} />
            </Field>
            <Field label="SKUs">
              <Ids ids={scope.skus} />
            </Field>
          </>
        )}
        <Field label="Depth limit">{scope.depth_limit}</Field>
        <Field label="Hop budget">{scope.hop_budget}</Field>
      </div>
    );
  }
  if (scope.kind === 'watcher') {
    return (
      <div>
        <Field label="Counterparties">
          <Ids ids={scope.counterparties} />
        </Field>
        <Field label="Signal types">
          <Signals types={scope.signal_types} />
        </Field>
        <Field label="Depth limit">{scope.depth_limit}</Field>
      </div>
    );
  }
  // phantom_demand
  return (
    <div>
      <Field label="Counterparty">
        <IdChip id={scope.counterparty} chars={24} />
      </Field>
      <Field label="SKUs">
        <Ids ids={scope.skus} />
      </Field>
      <Field label="Hypothetical quantity">{scope.hypothetical_quantity}</Field>
      <Field label="Hypothetical timeline">
        {scope.hypothetical_timeline ?? EMPTY}
      </Field>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/scope-summary.test.tsx`
Expected: PASS (5 tests). If a `Pill` definition-missing `console.warn` fires for `signal_type`, that is acceptable for now (identifiers carry their own `detail` tooltip); do not add to `PILL_DEFINITIONS` in this task.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/templates/_components/scope-summary.tsx src/app/account/sonar/templates/_components/__tests__/scope-summary.test.tsx
git commit -m "feat(templates): add read-only ScopeSummary renderer"
```

---

## Task 2: StepRail vertical navigation

**Files:**
- Create: `src/app/account/sonar/templates/_components/step-rail.tsx`
- Test: `src/app/account/sonar/templates/_components/__tests__/step-rail.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/account/sonar/templates/_components/__tests__/step-rail.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepRail } from '../step-rail';

const steps = [
  { id: 'identity', label: 'Identity', state: 'done' as const },
  { id: 'scope', label: 'Scope', state: 'locked' as const },
  { id: 'schedule', label: 'Schedule', state: 'active' as const },
  { id: 'lifecycle', label: 'Lifecycle', state: 'error' as const },
];

describe('StepRail', () => {
  it('renders every step label', () => {
    render(<StepRail steps={steps} onJump={vi.fn()} />);
    for (const s of steps) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    }
  });

  it('marks the active step with aria-current', () => {
    render(<StepRail steps={steps} onJump={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Schedule/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('calls onJump with the step id when a step is clicked', async () => {
    const onJump = vi.fn();
    render(<StepRail steps={steps} onJump={onJump} />);
    await userEvent.click(screen.getByRole('button', { name: /Identity/ }));
    expect(onJump).toHaveBeenCalledWith('identity');
  });

  it('locked step announces its locked state', () => {
    render(<StepRail steps={steps} onJump={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /Scope.*locked/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/step-rail.test.tsx`
Expected: FAIL — `Failed to resolve import "../step-rail"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/account/sonar/templates/_components/step-rail.tsx
'use client';

export type StepState = 'todo' | 'active' | 'done' | 'locked' | 'error';

export interface RailStep {
  id: string;
  label: string;
  state: StepState;
}

function badge(state: StepState, index: number) {
  if (state === 'locked') return '\u{1F512}';
  if (state === 'done') return '✓';
  if (state === 'error') return '!';
  return String(index + 1);
}

export function StepRail({
  steps,
  onJump,
}: {
  steps: RailStep[];
  onJump: (id: string) => void;
}) {
  return (
    <nav aria-label="Configuration steps" className="flex flex-col gap-1 min-w-[150px]">
      {steps.map((s, i) => {
        const active = s.state === 'active';
        const accessibleName =
          s.state === 'locked' ? `${s.label} (locked)` : s.label;
        return (
          <button
            key={s.id}
            type="button"
            aria-label={accessibleName}
            aria-current={active ? 'step' : undefined}
            onClick={() => onJump(s.id)}
            className={[
              'flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 text-left transition-colors',
              active
                ? 'font-semibold text-navy bg-white border border-slate/15'
                : s.state === 'done'
                  ? 'text-teal hover:bg-white/60'
                  : s.state === 'error'
                    ? 'text-rose-600 hover:bg-white/60'
                    : 'text-slate hover:bg-white/60',
            ].join(' ')}
          >
            <span
              aria-hidden
              className={[
                'w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold flex-none',
                active
                  ? 'bg-teal text-white'
                  : s.state === 'done'
                    ? 'bg-teal/25 text-teal'
                    : s.state === 'error'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-slate/15 text-slate',
              ].join(' ')}
            >
              {badge(s.state, i)}
            </span>
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/step-rail.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/templates/_components/step-rail.tsx src/app/account/sonar/templates/_components/__tests__/step-rail.test.tsx
git commit -m "feat(templates): add vertical StepRail with locked/jump states"
```

---

## Task 3: StepCard chrome

**Files:**
- Create: `src/app/account/sonar/templates/_components/step-card.tsx`
- Test: `src/app/account/sonar/templates/_components/__tests__/step-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/account/sonar/templates/_components/__tests__/step-card.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepCard } from '../step-card';

describe('StepCard', () => {
  it('renders the title, number badge, and children', () => {
    render(
      <StepCard id="x" index={0} title="Identity">
        <p>body</p>
      </StepCard>,
    );
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('locked variant shows a lock glyph instead of the number', () => {
    render(
      <StepCard id="x" index={1} title="Scope" locked>
        <p>scope</p>
      </StepCard>,
    );
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
  });

  it('exposes a scroll anchor with the step id', () => {
    const { container } = render(
      <StepCard id="schedule" index={2} title="Schedule">
        <p>x</p>
      </StepCard>,
    );
    expect(container.querySelector('#step-schedule')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/step-card.test.tsx`
Expected: FAIL — `Failed to resolve import "../step-card"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/account/sonar/templates/_components/step-card.tsx
import type { ReactNode } from 'react';

export function StepCard({
  id,
  index,
  title,
  locked = false,
  dim = false,
  children,
}: {
  id: string;
  index: number;
  title: string;
  locked?: boolean;
  dim?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`step-${id}`}
      className={[
        'scroll-mt-6 rounded-xl p-5 mb-3',
        locked
          ? 'bg-slate/5 border border-dashed border-slate/25'
          : 'bg-white border border-slate/15',
        dim ? 'opacity-50' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          aria-hidden
          className={[
            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-none',
            locked ? 'bg-slate/20 text-slate' : 'bg-teal/20 text-teal',
          ].join(' ')}
        >
          {locked ? '\u{1F512}' : index + 1}
        </span>
        <h2 className="text-sm font-semibold text-charcoal font-grotesk">
          {title}
        </h2>
        {locked && (
          <span className="ml-auto text-[10px] font-semibold text-orange bg-orange/10 rounded-full px-2.5 py-1">
            Fixed at creation
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/step-card.test.tsx`
Expected: PASS (3 tests). If `font-grotesk` is not a configured utility in this project, drop that class — verify with `grep -rn "font-grotesk\|Space Grotesk" src/app/globals.css tailwind.config.*` and use whatever heading-font utility the codebase already uses (or no class).

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/templates/_components/step-card.tsx src/app/account/sonar/templates/_components/__tests__/step-card.test.tsx
git commit -m "feat(templates): add StepCard chrome with locked variant"
```

---

## Task 4: Thin template-form into shared field fragments

**Files:**
- Modify: `src/app/account/sonar/templates/_components/template-form.tsx` (full rewrite — replace the 281-line monolith)
- Test: `src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx` (full rewrite)

This removes the create/edit branch and page layout. The submit/PATCH/DELETE logic moves to the shells in Tasks 5 and 6. Two exported fragments remain, consumed by both shells.

- [ ] **Step 1: Rewrite the test**

```tsx
// src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NameField, LifecycleFields } from '../template-form';

describe('NameField', () => {
  it('renders the labelled input and reports changes', async () => {
    const onChange = vi.fn();
    render(<NameField noun="Audit" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });
});

describe('LifecycleFields', () => {
  it('toggles enabled and edits retention', async () => {
    const onEnabled = vi.fn();
    const onRetention = vi.fn();
    render(
      <LifecycleFields
        enabled
        retentionDays={365}
        onEnabledChange={onEnabled}
        onRetentionChange={onRetention}
      />,
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /enabled/i }));
    expect(onEnabled).toHaveBeenCalledWith(false);
    const ret = screen.getByLabelText(/retention/i);
    await userEvent.clear(ret);
    await userEvent.type(ret, '90');
    expect(onRetention).toHaveBeenLastCalledWith(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx`
Expected: FAIL — `NameField`/`LifecycleFields` are not exported.

- [ ] **Step 3: Rewrite template-form.tsx**

```tsx
// src/app/account/sonar/templates/_components/template-form.tsx
'use client';

export function NameField({
  noun,
  value,
  onChange,
}: {
  noun: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm text-charcoal">
      <span className="block mb-1 font-medium">{noun} name</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-300 px-2 py-1 text-sm w-full max-w-md"
        required
      />
    </label>
  );
}

export function LifecycleFields({
  enabled,
  retentionDays,
  onEnabledChange,
  onRetentionChange,
}: {
  enabled: boolean;
  retentionDays: number;
  onEnabledChange: (v: boolean) => void;
  onRetentionChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          aria-label="Enabled"
        />
        Enabled
      </label>
      <label className="flex items-center gap-2 text-sm text-charcoal">
        <span>Retention (days)</span>
        <input
          type="number"
          aria-label="Retention (days)"
          value={retentionDays}
          min={30}
          max={365}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onRetentionChange(n);
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-20"
        />
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/templates/_components/template-form.tsx src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx
git commit -m "refactor(templates): thin template-form to shared field fragments"
```

---

## Task 5: TemplateEditor detail shell

**Files:**
- Create: `src/app/account/sonar/templates/_components/template-editor.tsx`
- Test: `src/app/account/sonar/templates/_components/__tests__/template-editor.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/account/sonar/templates/_components/__tests__/template-editor.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunTemplate } from '@haiwave/protocol';
import { TemplateEditor } from '../template-editor';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const template: RunTemplate = {
  template_id: 'abc',
  template_name: 'daily-audit',
  observation_class: 'audit',
  cadence: { kind: 'manual_only' },
  enabled: true,
  retention_days: 365,
  created_at: '2026-05-08T12:00:00.000Z',
  last_run_at: null,
  scope: {
    kind: 'audit',
    authorization_basis: 'bilateral',
    counterparties: ['acme-corp'],
    signal_types: ['lead_time_distribution'],
    skus: [],
    depth_limit: 2,
    hop_budget: 5,
  },
} as RunTemplate;

describe('TemplateEditor', () => {
  it('renders the read-only scope alongside editable name', () => {
    render(<TemplateEditor template={template} />);
    expect(screen.getByDisplayValue('daily-audit')).toBeInTheDocument();
    expect(screen.getByText('acme-corp')).toBeInTheDocument();
    expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
  });

  it('shows no save bar until a field changes', async () => {
    render(<TemplateEditor template={template} />);
    expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull();
    await userEvent.type(screen.getByLabelText(/audit name/i), 'X');
    expect(
      screen.getByRole('button', { name: /save changes/i }),
    ).toBeInTheDocument();
  });

  it('PATCHes only mutable fields on save', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    render(<TemplateEditor template={template} />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'Z');
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/account/sonar/templates/abc');
    expect((init as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      template_name: 'daily-auditZ',
      cadence: { kind: 'manual_only' },
      enabled: true,
      retention_days: 365,
    });
    expect(body).not.toHaveProperty('scope');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/template-editor.test.tsx`
Expected: FAIL — `Failed to resolve import "../template-editor"`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/account/sonar/templates/_components/template-editor.tsx
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Cadence, RunTemplate } from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { configNoun } from '../_lib/config-noun';
import { CadencePicker } from './cadence-picker';
import { StepRail, type RailStep } from './step-rail';
import { StepCard } from './step-card';
import { ScopeSummary } from './scope-summary';
import { NameField, LifecycleFields } from './template-form';

export function TemplateEditor({ template }: { template: RunTemplate }) {
  const noun = configNoun(template.observation_class);
  const [name, setName] = useState(template.template_name);
  const [cadence, setCadence] = useState<Cadence>(template.cadence);
  const [enabled, setEnabled] = useState(template.enabled);
  const [retentionDays, setRetentionDays] = useState(template.retention_days);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const router = useRouter();

  const dirty = useMemo(
    () =>
      name !== template.template_name ||
      enabled !== template.enabled ||
      retentionDays !== template.retention_days ||
      JSON.stringify(cadence) !== JSON.stringify(template.cadence),
    [name, enabled, retentionDays, cadence, template],
  );

  const steps: RailStep[] = [
    { id: 'identity', label: 'Identity', state: 'active' },
    { id: 'scope', label: 'Scope', state: 'locked' },
    { id: 'schedule', label: 'Schedule', state: 'todo' },
    { id: 'lifecycle', label: 'Lifecycle', state: 'todo' },
    { id: 'history', label: 'Run history', state: 'todo' },
  ];

  function jump(id: string) {
    document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSessionExpired(false);
    try {
      const res = await fetch(`/api/account/sonar/templates/${template.template_id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          template_name: name,
          cadence,
          enabled,
          retention_days: retentionDays,
        }),
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Delete ${noun.toLowerCase()} "${template.template_name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/sonar/templates/${template.template_id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      router.push('/account/sonar/templates');
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-6">
      <div className="pt-1">
        <StepRail steps={steps} onJump={jump} />
      </div>
      <div className="flex-1 max-w-2xl">
        <StepCard id="identity" index={0} title="Identity">
          <NameField noun={noun} value={name} onChange={setName} />
          <div className="mt-3 text-sm text-charcoal">
            <span className="text-[11px] uppercase tracking-wide text-slate mr-2">
              Modality
            </span>
            <span className="font-medium">{noun}</span>
            <span className="ml-2 text-xs text-slate">(fixed at creation)</span>
          </div>
        </StepCard>

        <StepCard id="scope" index={1} title="Scope" locked>
          <ScopeSummary scope={template.scope} />
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
          <CadencePicker value={cadence} onChange={setCadence} />
        </StepCard>

        <StepCard id="lifecycle" index={3} title="Lifecycle">
          <LifecycleFields
            enabled={enabled}
            retentionDays={retentionDays}
            onEnabledChange={setEnabled}
            onRetentionChange={setRetentionDays}
          />
        </StepCard>

        {error && <FormError message={error} sessionExpired={sessionExpired} />}

        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="rounded border border-rose-400 text-rose-700 px-3 py-1.5 text-sm hover:bg-rose-50 disabled:opacity-60"
          >
            Delete
          </button>
        </div>

        {dirty && (
          <div className="sticky bottom-0 mt-4 bg-navy text-white rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm">Unsaved changes</span>
            <button
              type="button"
              onClick={save}
              disabled={busy || name.length === 0}
              className="rounded bg-orange text-white px-4 py-1.5 text-sm font-semibold hover:bg-orange/90 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/template-editor.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/templates/_components/template-editor.tsx src/app/account/sonar/templates/_components/__tests__/template-editor.test.tsx
git commit -m "feat(templates): add TemplateEditor detail shell with locked scope + sticky save"
```

---

## Task 6: TemplateWizard creation shell

**Files:**
- Create: `src/app/account/sonar/templates/_components/template-wizard.tsx`
- Test: `src/app/account/sonar/templates/_components/__tests__/template-wizard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/account/sonar/templates/_components/__tests__/template-wizard.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateWizard } from '../template-wizard';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('TemplateWizard', () => {
  it('blocks Create and surfaces a name error when name is empty', async () => {
    render(<TemplateWizard />);
    await userEvent.click(
      screen.getByRole('button', { name: /create configuration/i }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('POSTs and routes to the new id on a valid audit create', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ template: { template_id: 'new-1' } }),
    } as Response);
    render(<TemplateWizard />);
    await userEvent.type(screen.getByLabelText(/audit name/i), 'my-tmpl');
    await userEvent.click(
      screen.getByRole('button', { name: /create configuration/i }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/sonar/templates',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(push).toHaveBeenCalledWith('/account/sonar/templates/new-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/template-wizard.test.tsx`
Expected: FAIL — `Failed to resolve import "../template-wizard"`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/app/account/sonar/templates/_components/template-wizard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Cadence,
  CreateRunTemplateRequest,
  RunTemplateScope,
} from '@haiwave/protocol';
import { describeApiError } from '@/lib/api-error';
import { FormError } from '@/components';
import { configNoun } from '../_lib/config-noun';
import { SYSTEM_AUDIT_HOP_BUDGET } from '../_lib/system-config';
import { CadencePicker } from './cadence-picker';
import { ScopePicker } from './scope-picker';
import { StepRail, type RailStep } from './step-rail';
import { StepCard } from './step-card';
import { NameField, LifecycleFields } from './template-form';

type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

function emptyScope(oc: ObservationClass): RunTemplateScope {
  if (oc === 'audit') {
    return {
      kind: 'audit',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: [],
      skus: [],
      depth_limit: 1,
      hop_budget: SYSTEM_AUDIT_HOP_BUDGET,
    };
  }
  if (oc === 'watcher') {
    return {
      kind: 'watcher',
      authorization_basis: 'bilateral',
      counterparties: [],
      signal_types: ['lead_time_distribution'],
      depth_limit: 1,
    };
  }
  return {
    kind: 'phantom_demand',
    authorization_basis: 'bilateral',
    counterparty: '',
    skus: [],
    hypothetical_quantity: 1,
    hypothetical_timeline: null,
  };
}

export function TemplateWizard({
  defaultObservationClass,
}: {
  defaultObservationClass?: ObservationClass;
}) {
  const [observationClass, setObservationClass] = useState<ObservationClass>(
    defaultObservationClass ?? 'audit',
  );
  const noun = configNoun(observationClass);
  const [name, setName] = useState('');
  const [cadence, setCadence] = useState<Cadence>({ kind: 'manual_only' });
  const [scope, setScope] = useState<RunTemplateScope>(
    emptyScope(observationClass),
  );
  const [enabled, setEnabled] = useState(true);
  const [retentionDays, setRetentionDays] = useState(365);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nameError, setNameError] = useState(false);
  const router = useRouter();

  function changeObservationClass(next: ObservationClass) {
    setObservationClass(next);
    setScope(emptyScope(next));
  }

  const pdIncomplete =
    observationClass === 'phantom_demand' &&
    scope.kind === 'phantom_demand' &&
    (scope.counterparty.length === 0 || scope.skus.length === 0);

  const steps: RailStep[] = [
    { id: 'identity', label: 'Identity', state: nameError ? 'error' : 'active' },
    { id: 'scope', label: 'Scope', state: pdIncomplete ? 'error' : 'todo' },
    { id: 'schedule', label: 'Schedule', state: 'todo' },
    { id: 'lifecycle', label: 'Lifecycle', state: 'todo' },
  ];

  function jump(id: string) {
    document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth' });
  }

  async function create() {
    setError(null);
    setSessionExpired(false);
    if (name.length === 0) {
      setNameError(true);
      setError('Name is required.');
      jump('identity');
      return;
    }
    setNameError(false);
    if (pdIncomplete) {
      setError('Phantom demand requires a counterparty and at least one SKU.');
      jump('scope');
      return;
    }
    setBusy(true);
    try {
      const body = {
        template_name: name,
        observation_class: observationClass,
        cadence,
        enabled,
        retention_days: retentionDays,
        scope,
      } as CreateRunTemplateRequest;
      const res = await fetch('/api/account/sonar/templates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const info = await describeApiError(res);
        setError(info.message);
        setSessionExpired(info.sessionExpired);
        return;
      }
      const payload = (await res.json().catch(() => null)) as
        | { template?: { template_id?: string } }
        | null;
      const newId = payload?.template?.template_id;
      if (!newId) {
        setError(
          `${noun} was created but the server response was malformed. Refresh the list to confirm.`,
        );
        return;
      }
      router.push(`/account/sonar/templates/${newId}`);
    } catch {
      setError('Network error — could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-6">
      <div className="pt-1">
        <StepRail steps={steps} onJump={jump} />
      </div>
      <div className="flex-1 max-w-2xl">
        <StepCard id="identity" index={0} title="Identity">
          <NameField noun={noun} value={name} onChange={setName} />
          <label className="block text-sm text-charcoal mt-3">
            <span className="block mb-1 font-medium" id="modality-label">
              Modality
            </span>
            <select
              aria-labelledby="modality-label"
              aria-label="Modality"
              value={observationClass}
              onChange={(e) =>
                changeObservationClass(e.target.value as ObservationClass)
              }
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="audit">Audit</option>
              <option value="watcher">Watcher</option>
              <option value="phantom_demand">Phantom Demand</option>
            </select>
          </label>
        </StepCard>

        <StepCard id="scope" index={1} title="Scope">
          <ScopePicker
            observationClass={observationClass}
            value={scope}
            onChange={setScope}
          />
        </StepCard>

        <StepCard id="schedule" index={2} title="Schedule">
          <CadencePicker value={cadence} onChange={setCadence} />
        </StepCard>

        <StepCard id="lifecycle" index={3} title="Lifecycle">
          <LifecycleFields
            enabled={enabled}
            retentionDays={retentionDays}
            onEnabledChange={setEnabled}
            onRetentionChange={setRetentionDays}
          />
        </StepCard>

        {error && <FormError message={error} sessionExpired={sessionExpired} />}

        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="rounded bg-teal text-white px-4 py-1.5 text-sm font-medium hover:bg-teal/90 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/account/sonar/templates/_components/__tests__/template-wizard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/account/sonar/templates/_components/template-wizard.tsx src/app/account/sonar/templates/_components/__tests__/template-wizard.test.tsx
git commit -m "feat(templates): add single-page TemplateWizard with validate-at-end"
```

---

## Task 7: Wire the pages to the new shells

**Files:**
- Modify: `src/app/account/sonar/templates/new/page.tsx`
- Modify: `src/app/account/sonar/templates/[id]/page.tsx`
- Test: `src/app/account/sonar/templates/new/__tests__/page.test.tsx` (update), `src/app/account/sonar/templates/[id]/__tests__/page.test.tsx` (update)

- [ ] **Step 1: Update the detail page test fixture to the discriminated scope shape and assert scope is visible**

In `src/app/account/sonar/templates/[id]/__tests__/page.test.tsx`, replace the `scope` object in every mocked template payload with the protocol shape and add an assertion. Example for the existing "renders the template name" test — set:

```tsx
scope: {
  kind: 'audit',
  authorization_basis: 'bilateral',
  counterparties: ['acme-corp'],
  signal_types: [],
  skus: [],
  depth_limit: 1,
  hop_budget: 5,
},
```

and add, after the existing name assertion:

```tsx
expect(await screen.findByText('acme-corp')).toBeInTheDocument();
expect(screen.getByText(/Fixed at creation/i)).toBeInTheDocument();
```

Remove any now-invalid fields (`scope_type`, `scope_ids`, `last_run_id`, `initiator_participant_id`, `created_by_user_id`) from the fixtures — `RunTemplate` does not require them and they are unused by the new render path. Keep `template_id`, `template_name`, `observation_class`, `cadence`, `enabled`, `retention_days`, `created_at`, `last_run_at`, `scope`.

- [ ] **Step 2: Run the page tests to verify they fail**

Run: `npx vitest run "src/app/account/sonar/templates/[id]/__tests__/page.test.tsx" src/app/account/sonar/templates/new/__tests__/page.test.tsx`
Expected: FAIL — scope text not found / `TemplateForm` still rendered.

- [ ] **Step 3: Rewrite new/page.tsx**

```tsx
// src/app/account/sonar/templates/new/page.tsx
import { TemplateWizard } from '../_components/template-wizard';
import { configNoun } from '../_lib/config-noun';

interface NewTemplatePageProps {
  searchParams: Promise<{ observation_class?: string }>;
}

function isObservationClass(
  v: unknown,
): v is 'audit' | 'watcher' | 'phantom_demand' {
  return v === 'audit' || v === 'watcher' || v === 'phantom_demand';
}

export default async function NewTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const params = await searchParams;
  const defaultClass = isObservationClass(params.observation_class)
    ? params.observation_class
    : undefined;
  const heading = defaultClass
    ? `New ${configNoun(defaultClass)}`
    : 'New configuration';
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-charcoal mb-4">{heading}</h1>
      <TemplateWizard defaultObservationClass={defaultClass} />
    </div>
  );
}
```

- [ ] **Step 4: Rewrite [id]/page.tsx**

```tsx
// src/app/account/sonar/templates/[id]/page.tsx
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { RunTemplate } from '@haiwave/protocol';
import { TemplateEditor } from '../_components/template-editor';
import { ManualTriggerButton } from './_components/manual-trigger-button';
import { TemplateRunHistory } from './_components/template-run-history';
import { formatCadence } from '../_lib/format-cadence';

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

async function loadTemplate(templateId: string): Promise<RunTemplate | null> {
  const cookieHeader = (await cookies()).toString();
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(
      `${proto}://${host}/api/account/sonar/templates/${templateId}`,
      { headers: { cookie: cookieHeader }, cache: 'no-store' },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const payload = (await res.json()) as { template: RunTemplate };
    return payload.template;
  } catch (err) {
    console.error('[template detail] fetch failed', err);
    return null;
  }
}

export default async function TemplateDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) notFound();
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href="/account/sonar/templates"
            className="text-sm text-teal hover:underline"
          >
            ← Configurations
          </Link>
          <h1 className="text-xl font-semibold text-charcoal mt-2">
            {template.template_name}
          </h1>
          <p className="text-sm text-slate mt-1">
            {template.observation_class === 'audit' ? 'Audit' : 'Watcher'} ·{' '}
            {formatCadence(template.cadence)} · Last run{' '}
            {template.last_run_at
              ? new Date(template.last_run_at).toLocaleString()
              : '—'}
          </p>
        </div>
        <ManualTriggerButton
          templateId={template.template_id}
          enabled={template.enabled}
          observationClass={template.observation_class}
        />
      </header>

      <TemplateEditor template={template} />

      <section id="step-history" className="space-y-3 scroll-mt-6">
        <h2 className="text-sm font-semibold text-charcoal">Run history</h2>
        <TemplateRunHistory
          templateId={template.template_id}
          observationClass={template.observation_class}
        />
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Run the page tests to verify they pass**

Run: `npx vitest run "src/app/account/sonar/templates/[id]/__tests__/page.test.tsx" src/app/account/sonar/templates/new/__tests__/page.test.tsx`
Expected: PASS. If the `new/page.tsx` test asserted on `TemplateForm` internals (e.g. a "Create audit" button), update those assertions to the wizard's "Create configuration" button and `defaultObservationClass` heading behavior — repeat the exact button label `Create configuration` from Task 6.

- [ ] **Step 6: Commit**

```bash
git add "src/app/account/sonar/templates/new/page.tsx" "src/app/account/sonar/templates/[id]/page.tsx" "src/app/account/sonar/templates/new/__tests__/page.test.tsx" "src/app/account/sonar/templates/[id]/__tests__/page.test.tsx"
git commit -m "feat(templates): wire new+detail pages to wizard/editor shells"
```

---

## Task 8: Full verification gates

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + lint + full test suite**

Run: `npm run build`
Expected: succeeds with no TypeScript errors. (Per project gotcha: vitest passing does NOT imply tsc passes — this step is mandatory.)

Run: `npm run lint`
Expected: no new lint errors in `src/app/account/sonar/templates/**`.

Run: `npx vitest run src/app/account/sonar/templates`
Expected: all templates tests pass (scope-summary, step-rail, step-card, template-form, template-editor, template-wizard, both page tests, plus the untouched cadence-picker / scope-picker / counterparty-picker / partner-sku-picker / phantom-demand-scope-fields / list-page / run-history tests).

- [ ] **Step 2: Manual smoke (report results, do not skip)**

With `npm run dev` running, open `http://localhost:3001/account/sonar/templates/new` — confirm the rail + four step-cards render and Create works for an audit. Open an existing template detail page — confirm the locked Scope card shows counterparties/signal types/depth, editing the name reveals the sticky save bar, Save persists, and Delete still works.

- [ ] **Step 3: Commit any fixups**

```bash
git add -A
git commit -m "chore(templates): verification fixups"
```

(Skip this commit if Steps 1–2 produced no changes.)

---

## Self-Review

**Spec coverage:**
- Read-only scope alongside editable fields → Task 1 (ScopeSummary) + Task 5 (locked card in editor). ✓
- Detail edit model: always-editable inline + sticky save bar, scope never editable → Task 5. ✓
- Detail layout: stepped rail, Scope=lock glyph, Run history as rail entry → Task 2 + Task 5 + Task 7 Step 4. ✓
- Creation wizard: single page + rail, one Create, validate-at-end → Task 6. ✓
- Pills decision: signal types via `<Pill>`, counterparties/SKUs via `<IdChip>` (the approved non-Pill identifier rendering) with documenting comment → Task 1. ✓
- Component decomposition (step-rail/step-card/scope-summary/two shells, template-form thinned) → Tasks 1–6. ✓
- No protocol/BFF/haiCore change; data flow unchanged → Tasks 5–7 reuse existing endpoints/contracts. ✓
- Validation rules (name-required + pdIncomplete) preserved → Task 6. ✓
- Testing per spec + tsc/lint gates → Tasks 1–8. ✓
- Out of scope (list page, scope mutability, gated stepper) → not touched. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; the two conditional notes (font-grotesk utility check in Task 3, new/page test-assertion update in Task 7) give an explicit verification command and concrete fallback, not a vague "handle it".

**Type consistency:** `RailStep`/`StepState` defined in Task 2 and imported by Tasks 5–6; `NameField`/`LifecycleFields` signatures defined in Task 4 and consumed unchanged in Tasks 5–6; `emptyScope`/`pdIncomplete` mirror the existing `scope-picker.tsx` shapes and the protocol union from the File Structure section; PATCH body matches the existing route contract (`template_name`,`cadence`,`enabled`,`retention_days`).
