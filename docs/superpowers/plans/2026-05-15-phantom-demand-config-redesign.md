# Phantom Demand Config Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phantom Demand template scope's free-text counterparty/SKU inputs with a trading-pair counterparty picker and a partner-scoped flat SKU picker, reorder the fields, relabel the date field, and relax the `skus` protocol constraint so real SKU ids validate.

**Architecture:** Approach 2 — a new `phantom-demand-scope-fields.tsx` (with `counterparty-picker.tsx` + `partner-sku-picker.tsx`) replaces the PD branch of `scope-picker.tsx`; the audit-nominations flow is a pattern reference only and is not modified. One backward-compatible `@haiwave/protocol` change relaxes `PhantomDemandScopeSchema.skus` from `uuid[]` to non-empty `string[]`.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), React client components, Tailwind v4, Vitest + @testing-library/react + @testing-library/user-event. Protocol: Zod in `@haiwave/protocol` (haiCore workspace, consumed by HaiWeb via `file:` dep).

**Spec:** `docs/superpowers/specs/2026-05-15-phantom-demand-config-redesign-design.md`

**Repos/paths:**
- HaiWeb: `C:\Users\SamFleming\HaiWeb` (branch `v.1.31`)
- haiCore: `C:\Users\SamFleming\haiCore` (branch `v.1.31`)

---

### Task 1: Relax `PhantomDemandScopeSchema.skus` (protocol, backward compatible)

**Files:**
- Modify: `C:\Users\SamFleming\haiCore\packages\protocol\src\phantom-demand\scope.ts`
- Modify: `C:\Users\SamFleming\haiCore\packages\protocol\src\version.ts`
- Test: `C:\Users\SamFleming\haiCore\packages\protocol\src\phantom-demand\__tests__\scope.test.ts`

- [ ] **Step 1: Add a failing test for non-UUID SKU acceptance**

In `scope.test.ts`, add this test inside the `describe('PhantomDemandScopeSchema', …)` block, after the existing `it('accepts a valid scope with one SKU', …)`:

```ts
  it('accepts non-UUID SKU id strings (external_product_id)', () => {
    const valid = {
      kind: 'phantom_demand' as const,
      authorization_basis: 'bilateral' as const,
      counterparty: '00000000-0000-0000-0000-000000000001',
      skus: ['AC-LENS-2200', 'FAST-HEX-M8'],
      hypothetical_quantity: 100,
      hypothetical_timeline: null,
    };
    expect(() => PhantomDemandScopeSchema.parse(valid)).not.toThrow();
  });

  it('still rejects an empty SKU string', () => {
    expect(() =>
      PhantomDemandScopeSchema.parse({
        kind: 'phantom_demand',
        authorization_basis: 'bilateral',
        counterparty: '00000000-0000-0000-0000-000000000001',
        skus: [''],
        hypothetical_quantity: 100,
        hypothetical_timeline: null,
      }),
    ).toThrow();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `C:\Users\SamFleming\haiCore`):
```
npx vitest run packages/protocol/src/phantom-demand/__tests__/scope.test.ts
```
Expected: FAIL — `accepts non-UUID SKU id strings` throws because `skus` currently requires `z.string().uuid()`.

- [ ] **Step 3: Relax the schema**

In `packages/protocol/src/phantom-demand/scope.ts`, change the `skus` line. Replace:

```ts
  skus: z.array(z.string().uuid()).min(1),
```

with:

```ts
  // v1.31: relaxed from .uuid() — sku_id is the vendor's external product id
  // (network_index.external_product_id), echoed to the responder which
  // resolves products.product_id = sku_id. It is not a haiCore UUID. Still
  // .min(1): at least one SKU is required.
  skus: z.array(z.string().min(1)).min(1),
```

- [ ] **Step 4: Bump the protocol version**

In `packages/protocol/src/version.ts`, change:

```ts
export const PROTOCOL_VERSION = '3.0.0';
```

to:

```ts
export const PROTOCOL_VERSION = '3.1.0';
```

(Minor bump: additive/loosening, backward compatible.)

- [ ] **Step 5: Run protocol tests to verify pass**

Run (from `C:\Users\SamFleming\haiCore`):
```
npx vitest run packages/protocol/src/phantom-demand/__tests__/scope.test.ts
```
Expected: PASS (5 tests). The pre-existing `rejects empty SKU list`, `accepts a valid scope with one SKU`, and `rejects authorization_basis other than bilateral` still pass (UUIDs are valid non-empty strings; `.min(1)` array constraint unchanged).

- [ ] **Step 6: Rebuild the protocol package so HaiWeb picks up the change**

Run (from `C:\Users\SamFleming\haiCore`):
```
npm run build
```
Expected: build succeeds. (HaiWeb consumes `@haiwave/protocol` via the `file:` dependency; the compiled output must be refreshed before HaiWeb typechecks against the new schema.)

- [ ] **Step 7: Commit**

```
cd /c/Users/SamFleming/haiCore
git add packages/protocol/src/phantom-demand/scope.ts packages/protocol/src/version.ts packages/protocol/src/phantom-demand/__tests__/scope.test.ts
git commit -m "feat(protocol): relax PhantomDemandScopeSchema.skus to non-empty string[]

sku_id is the vendor external_product_id echoed to the responder, not
a haiCore UUID. Backward compatible; protocol 3.0.0 -> 3.1.0."
```

---

### Task 2: `CounterpartyPicker` component (trading-pair list, single select)

**Files:**
- Create: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\counterparty-picker.tsx`
- Test: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\__tests__\counterparty-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/counterparty-picker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CounterpartyPicker } from '../counterparty-picker';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

const PARTNERS = [
  { id: 'p-tp-1', company_name: 'Great Lakes Hardware', status: 'trading_pair', industry: 'Hardware', location: 'Detroit, MI' },
  { id: 'p-ap-1', company_name: 'Approved Only Co', status: 'approved', industry: 'Misc', location: 'Reno, NV' },
  { id: 'p-tp-2', company_name: 'MidWest Fastener', status: 'trading_pair', industry: 'Fasteners', location: 'Chicago, IL' },
];

function resolvePartners() {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(PARTNERS), { status: 200 }));
}

describe('CounterpartyPicker', () => {
  it('lists only trading_pair partners and excludes approved', async () => {
    resolvePartners();
    render(<CounterpartyPicker value="" onChange={vi.fn()} />);
    expect(await screen.findByText('Great Lakes Hardware')).toBeInTheDocument();
    expect(screen.getByText('MidWest Fastener')).toBeInTheDocument();
    expect(screen.queryByText('Approved Only Co')).not.toBeInTheDocument();
  });

  it('filters by company name via the search box', async () => {
    resolvePartners();
    render(<CounterpartyPicker value="" onChange={vi.fn()} />);
    await screen.findByText('Great Lakes Hardware');
    await userEvent.type(screen.getByPlaceholderText(/search trading partners/i), 'midwest');
    expect(screen.queryByText('Great Lakes Hardware')).not.toBeInTheDocument();
    expect(screen.getByText('MidWest Fastener')).toBeInTheDocument();
  });

  it('emits the participant id on selection (single select)', async () => {
    resolvePartners();
    const onChange = vi.fn();
    render(<CounterpartyPicker value="" onChange={onChange} />);
    await userEvent.click(await screen.findByText('MidWest Fastener'));
    expect(onChange).toHaveBeenCalledWith('p-tp-2');
  });

  it('shows an explanatory empty state when no trading pairs exist', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'x', company_name: 'A', status: 'approved' }]), { status: 200 }),
    );
    render(<CounterpartyPicker value="" onChange={vi.fn()} />);
    expect(await screen.findByText(/no trading pairs/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `C:\Users\SamFleming\HaiWeb`):
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/counterparty-picker.test.tsx
```
Expected: FAIL — module `../counterparty-picker` does not exist.

- [ ] **Step 3: Implement the component**

Create `counterparty-picker.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

interface PartnerRow {
  id: string;
  company_name: string;
  status: string;
  industry?: string;
  location?: string;
}

interface Props {
  value: string;
  onChange: (participantId: string) => void;
}

export function CounterpartyPicker({ value, onChange }: Props) {
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/account/partners');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as PartnerRow[];
        if (!cancelled) setPartners(Array.isArray(body) ? body : []);
      } catch {
        if (!cancelled) setError("Couldn't load trading partners. Try again in a moment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const eligible = useMemo(
    () => partners.filter((p) => p.status === 'trading_pair'),
    [partners],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((p) => p.company_name.toLowerCase().includes(q));
  }, [eligible, query]);

  if (loading) return <p className="text-sm text-slate italic">Loading trading partners…</p>;
  if (error) {
    return (
      <div className="rounded border border-problem/30 bg-problem/5 px-3 py-2 text-sm text-problem">
        {error}
      </div>
    );
  }
  if (eligible.length === 0) {
    return (
      <div className="rounded border border-slate/20 bg-light-gray px-3 py-2 text-sm text-slate">
        No trading pairs yet. Phantom Demand can only run against an established
        trading pair — establish one from Trading Partners first.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search trading partners…"
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-slate italic">No matching trading partners.</p>
      ) : (
        <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 max-h-72 overflow-y-auto">
          {filtered.map((p) => {
            const selected = p.id === value;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onChange(p.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selected ? 'bg-teal/10' : 'hover:bg-light-gray'
                  }`}
                >
                  <p className="text-sm font-medium text-charcoal">
                    {p.company_name}
                    {selected && <span className="ml-2 text-teal">✓</span>}
                  </p>
                  <p className="text-xs text-slate">
                    {[p.industry, p.location, p.status].filter(Boolean).join(' · ')}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/counterparty-picker.test.tsx
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```
cd /c/Users/SamFleming/HaiWeb
git add src/app/account/sonar/templates/_components/counterparty-picker.tsx src/app/account/sonar/templates/_components/__tests__/counterparty-picker.test.tsx
git commit -m "feat(sonar): trading-pair counterparty picker for PD templates"
```

---

### Task 3: `PartnerSkuPicker` component (flat product list + free-text)

**Files:**
- Create: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\partner-sku-picker.tsx`
- Test: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\__tests__\partner-sku-picker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/partner-sku-picker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PartnerSkuPicker } from '../partner-sku-picker';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

function resolveProducts() {
  fetchMock.mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        products: [
          { external_product_id: 'AC-LENS-2200', product_name: null, primary_class_slug: null },
          { external_product_id: 'FAST-HEX-M8', product_name: null, primary_class_slug: null },
        ],
        total: 2,
      }),
      { status: 200 },
    ),
  );
}

describe('PartnerSkuPicker', () => {
  it('is disabled with a hint when no counterparty is selected', () => {
    render(<PartnerSkuPicker counterpartyId="" value={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/select a counterparty first/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the partner product list flat (no class_id) and toggles selection', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={[]} onChange={onChange} />);
    await userEvent.click(await screen.findByText('AC-LENS-2200'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/account/partners/p1/catalog/products?page=1&size=500',
    );
    expect(onChange).toHaveBeenCalledWith(['AC-LENS-2200']);
  });

  it('adds a free-text SKU, trimming and de-duping', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={['AC-LENS-2200']} onChange={onChange} />);
    await screen.findByText('FAST-HEX-M8');
    await userEvent.type(screen.getByPlaceholderText(/sku i have in mind/i), '  MY-CUSTOM-1  ');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).toHaveBeenCalledWith(['AC-LENS-2200', 'MY-CUSTOM-1']);
  });

  it('does not add a duplicate free-text SKU', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={['DUP-1']} onChange={onChange} />);
    await screen.findByText('FAST-HEX-M8');
    await userEvent.type(screen.getByPlaceholderText(/sku i have in mind/i), 'DUP-1');
    await userEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes a selected SKU via its chip', async () => {
    resolveProducts();
    const onChange = vi.fn();
    render(<PartnerSkuPicker counterpartyId="p1" value={['AC-LENS-2200', 'X-1']} onChange={onChange} />);
    await screen.findByText('FAST-HEX-M8');
    await userEvent.click(screen.getByRole('button', { name: /remove X-1/i }));
    expect(onChange).toHaveBeenCalledWith(['AC-LENS-2200']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/partner-sku-picker.test.tsx
```
Expected: FAIL — module `../partner-sku-picker` does not exist.

- [ ] **Step 3: Implement the component**

Create `partner-sku-picker.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

interface CatalogProduct {
  external_product_id: string;
  product_name: string | null;
  primary_class_slug: string | null;
}

interface Props {
  counterpartyId: string;
  value: string[];
  onChange: (skus: string[]) => void;
}

const PAGE_SIZE = 500;

export function PartnerSkuPicker({ counterpartyId, value, onChange }: Props) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!counterpartyId) {
      setProducts([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/account/partners/${encodeURIComponent(counterpartyId)}/catalog/products?page=1&size=${PAGE_SIZE}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { products: CatalogProduct[]; total: number };
        if (!cancelled) {
          setProducts(body.products ?? []);
          setTotal(body.total ?? 0);
        }
      } catch {
        if (!cancelled) setError("Couldn't load this partner's catalog.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [counterpartyId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.external_product_id.toLowerCase().includes(q));
  }, [products, query]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  if (!counterpartyId) {
    return (
      <p className="text-sm text-slate italic">
        Select a counterparty first to choose SKUs from its catalog.
      </p>
    );
  }

  function toggle(id: string) {
    if (selectedSet.has(id)) onChange(value.filter((s) => s !== id));
    else onChange([...value, id]);
  }

  function addDraft() {
    const trimmed = draft.trim();
    if (!trimmed || selectedSet.has(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded bg-teal/10 px-2 py-0.5 text-xs text-teal-dark"
            >
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => onChange(value.filter((x) => x !== s))}
                className="text-teal hover:text-problem"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter this partner's catalog…"
        className="w-full px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
      />

      {loading && <p className="text-xs text-slate italic">Loading catalog…</p>}
      {error && <p className="text-xs text-problem">{error}</p>}
      {!loading && !error && (
        <>
          {total > PAGE_SIZE && (
            <p className="text-xs text-slate italic">
              Showing the first {PAGE_SIZE} of {total}. Use the filter to narrow.
            </p>
          )}
          {filtered.length === 0 ? (
            <p className="text-sm text-slate italic">
              No matching products. Add a SKU by id below.
            </p>
          ) : (
            <ul className="border border-slate/20 rounded-lg divide-y divide-slate/10 max-h-60 overflow-y-auto">
              {filtered.map((p) => {
                const checked = selectedSet.has(p.external_product_id);
                return (
                  <li key={p.external_product_id} className="flex items-center gap-3 px-4 py-2">
                    <input
                      id={`sku-${p.external_product_id}`}
                      type="checkbox"
                      aria-label={p.external_product_id}
                      checked={checked}
                      onChange={() => toggle(p.external_product_id)}
                      className="h-4 w-4 accent-teal"
                    />
                    <label
                      htmlFor={`sku-${p.external_product_id}`}
                      className="flex-1 min-w-0 cursor-pointer text-sm text-charcoal truncate"
                    >
                      {p.external_product_id}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="SKU I have in mind…"
          className="flex-1 px-3 py-2 border border-slate/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <button
          type="button"
          onClick={addDraft}
          className="rounded bg-navy text-white px-3 py-2 text-sm font-medium hover:bg-charcoal"
        >
          Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/partner-sku-picker.test.tsx
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```
cd /c/Users/SamFleming/HaiWeb
git add src/app/account/sonar/templates/_components/partner-sku-picker.tsx src/app/account/sonar/templates/_components/__tests__/partner-sku-picker.test.tsx
git commit -m "feat(sonar): partner-scoped flat SKU picker with free-text add"
```

---

### Task 4: `PhantomDemandScopeFields` (compose, order, relabel, D9 reset)

**Files:**
- Create: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\phantom-demand-scope-fields.tsx`
- Test: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\__tests__\phantom-demand-scope-fields.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/phantom-demand-scope-fields.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhantomDemandScopeFields } from '../phantom-demand-scope-fields';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // CounterpartyPicker fetches /api/account/partners on mount.
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify([
        { id: 'cp-1', company_name: 'Great Lakes Hardware', status: 'trading_pair' },
      ]),
      { status: 200 },
    ),
  );
});

const BASE = {
  kind: 'phantom_demand' as const,
  authorization_basis: 'bilateral' as const,
  counterparty: '',
  skus: [] as string[],
  hypothetical_quantity: 1,
  hypothetical_timeline: null as string | null,
};

describe('PhantomDemandScopeFields', () => {
  it('renders the relabeled "Target Delivery Date" and not "Hypothetical Timeline"', () => {
    render(<PhantomDemandScopeFields value={BASE} onChange={vi.fn()} />);
    expect(screen.getByText(/target delivery date/i)).toBeInTheDocument();
    expect(screen.queryByText(/hypothetical timeline/i)).not.toBeInTheDocument();
  });

  it('emits quantity changes preserving scope shape', async () => {
    const onChange = vi.fn();
    render(<PhantomDemandScopeFields value={BASE} onChange={onChange} />);
    const qty = screen.getByLabelText(/hypothetical quantity/i);
    await userEvent.clear(qty);
    await userEvent.type(qty, '250');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'phantom_demand', hypothetical_quantity: 250 }),
    );
  });

  it('selecting a counterparty resets skus (D9)', async () => {
    const onChange = vi.fn();
    render(
      <PhantomDemandScopeFields
        value={{ ...BASE, skus: ['STALE-1'] }}
        onChange={onChange}
      />,
    );
    await userEvent.click(await screen.findByText('Great Lakes Hardware'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ counterparty: 'cp-1', skus: [] }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/phantom-demand-scope-fields.test.tsx
```
Expected: FAIL — module `../phantom-demand-scope-fields` does not exist.

- [ ] **Step 3: Implement the component**

Create `phantom-demand-scope-fields.tsx`:

```tsx
'use client';

import type { RunTemplateScope } from '@haiwave/protocol';
import { CounterpartyPicker } from './counterparty-picker';
import { PartnerSkuPicker } from './partner-sku-picker';

type PdScope = Extract<RunTemplateScope, { kind: 'phantom_demand' }>;

interface Props {
  value: PdScope;
  onChange: (next: PdScope) => void;
}

export function PhantomDemandScopeFields({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Hypothetical Quantity</span>
        <input
          type="number"
          aria-label="Hypothetical Quantity"
          min={1}
          value={value.hypothetical_quantity}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(n)) onChange({ ...value, hypothetical_quantity: n });
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm w-32"
        />
      </label>

      <label className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Target Delivery Date</span>
        <input
          type="datetime-local"
          aria-label="Target Delivery Date"
          value={value.hypothetical_timeline ?? ''}
          onChange={(e) =>
            onChange({ ...value, hypothetical_timeline: e.target.value || null })
          }
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <span className="block text-xs text-slate mt-1">Empty = as soon as possible</span>
      </label>

      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">Counterparty</span>
        <CounterpartyPicker
          value={value.counterparty}
          onChange={(participantId) =>
            onChange({ ...value, counterparty: participantId, skus: [] })
          }
        />
        {value.counterparty && value.skus.length === 0 && (
          <span className="block text-xs text-slate mt-1">
            SKU selection resets when you change the counterparty.
          </span>
        )}
      </div>

      <div className="block text-sm text-charcoal">
        <span className="block mb-1 font-medium">SKUs</span>
        <PartnerSkuPicker
          counterpartyId={value.counterparty}
          value={value.skus}
          onChange={(skus) => onChange({ ...value, skus })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/phantom-demand-scope-fields.test.tsx
```
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```
cd /c/Users/SamFleming/HaiWeb
git add src/app/account/sonar/templates/_components/phantom-demand-scope-fields.tsx src/app/account/sonar/templates/_components/__tests__/phantom-demand-scope-fields.test.tsx
git commit -m "feat(sonar): PhantomDemandScopeFields — reorder, relabel, D9 reset"
```

---

### Task 5: Delegate `scope-picker.tsx` PD branch to the new component

**Files:**
- Modify: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\scope-picker.tsx`
- Test: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\__tests__\scope-picker.test.tsx`

- [ ] **Step 1: Update the existing test to assert delegation**

In `__tests__/scope-picker.test.tsx`, locate the phantom_demand test(s). Replace any test that asserts the old free-text Counterparty/SKU inputs with this test (keep audit/watcher tests unchanged):

```tsx
  it('phantom_demand renders the delegated scope fields (Target Delivery Date, not free-text timeline)', () => {
    const onChange = vi.fn();
    render(
      <ScopePicker
        observationClass="phantom_demand"
        value={{
          kind: 'phantom_demand',
          authorization_basis: 'bilateral',
          counterparty: '',
          skus: [],
          hypothetical_quantity: 1,
          hypothetical_timeline: null,
        }}
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/target delivery date/i)).toBeInTheDocument();
    expect(screen.getByText('Counterparty')).toBeInTheDocument();
    expect(screen.getByText('SKUs')).toBeInTheDocument();
  });
```

If the test file does not already stub `fetch`, add at the top of its `beforeEach` (CounterpartyPicker fetches on mount):

```tsx
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })));
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/scope-picker.test.tsx
```
Expected: FAIL — `Target Delivery Date` not found (the old PD branch still renders "Hypothetical Timeline" / free-text inputs).

- [ ] **Step 3: Replace the phantom_demand branch**

In `scope-picker.tsx`, add this import near the existing imports (after the `SYSTEM_AUDIT_HOP_BUDGET` import line):

```tsx
import { PhantomDemandScopeFields } from './phantom-demand-scope-fields';
```

Then replace the entire phantom_demand branch. Delete from the line:

```tsx
  // phantom_demand branch
  const pdValue = value.kind === 'phantom_demand' ? value : null;
```

through the end of that branch's returned JSX (the closing `);` immediately before the `function NumberField({` declaration — i.e. the whole block that renders Counterparty / SKUs / Hypothetical Quantity / Hypothetical Timeline). Replace it with:

```tsx
  // phantom_demand branch — delegated to a dedicated component (v1.31).
  const pdValue: Extract<RunTemplateScope, { kind: 'phantom_demand' }> =
    value.kind === 'phantom_demand'
      ? value
      : {
          kind: 'phantom_demand',
          authorization_basis: 'bilateral',
          counterparty: '',
          skus: [],
          hypothetical_quantity: 1,
          hypothetical_timeline: null,
        };
  return <PhantomDemandScopeFields value={pdValue} onChange={onChange} />;
```

Ensure `RunTemplateScope` is imported from `@haiwave/protocol` in this file (it already imports protocol types; add `RunTemplateScope` to that import if absent). Leave the `NumberField` helper and the audit/watcher branches untouched.

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/scope-picker.test.tsx
```
Expected: PASS — the new delegation test passes; audit/watcher tests still pass.

- [ ] **Step 5: Typecheck the changed file**

Run:
```
npx tsc --noEmit 2>&1 | grep -E "scope-picker|phantom-demand-scope-fields|counterparty-picker|partner-sku-picker" || echo "clean"
```
Expected: `clean`.

- [ ] **Step 6: Commit**

```
cd /c/Users/SamFleming/HaiWeb
git add src/app/account/sonar/templates/_components/scope-picker.tsx src/app/account/sonar/templates/_components/__tests__/scope-picker.test.tsx
git commit -m "refactor(sonar): delegate scope-picker PD branch to PhantomDemandScopeFields"
```

---

### Task 6: Relocate `<ScopePicker>` (D8) + PD submit gate

**Files:**
- Modify: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\template-form.tsx`
- Test: `C:\Users\SamFleming\HaiWeb\src\app\account\sonar\templates\_components\__tests__\template-form.test.tsx`

- [ ] **Step 1: Write the failing tests**

In `__tests__/template-form.test.tsx`, add inside `describe('TemplateForm — create mode', …)`:

```tsx
  it('renders the scope picker after the Enabled/Retention controls (D8)', () => {
    render(<TemplateForm defaultObservationClass="audit" />);
    const html = document.body.innerHTML;
    // "Enabled" label appears before the audit scope legend "Audit scope".
    expect(html.indexOf('Enabled')).toBeGreaterThan(-1);
    expect(html.indexOf('Audit scope')).toBeGreaterThan(html.indexOf('Enabled'));
  });

  it('disables Create for phantom_demand until counterparty AND >=1 sku are set', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('[]', { status: 200 })),
    );
    render(<TemplateForm defaultObservationClass="phantom_demand" />);
    await userEvent.type(screen.getByLabelText(/template name/i), 'pd-1');
    expect(screen.getByRole('button', { name: /create template/i })).toBeDisabled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx
```
Expected: FAIL — scope picker currently renders *before* Enabled/Retention; the PD submit gate does not yet exist (button enabled with only a name).

- [ ] **Step 3: Relocate the ScopePicker block**

In `template-form.tsx`, delete this block (currently rendered before the Enabled/Retention `div`):

```tsx
      {!isEdit && (
        <ScopePicker
          observationClass={observationClass}
          value={scope}
          onChange={setScope}
        />
      )}

```

Then insert the same block immediately **after** the Enabled/Retention `</div>` and immediately **before** the `{error && <FormError …/>}` line, so the order becomes: Enabled/Retention `div` → ScopePicker → FormError → buttons:

```tsx
      </div>

      {!isEdit && (
        <ScopePicker
          observationClass={observationClass}
          value={scope}
          onChange={setScope}
        />
      )}

      {error && <FormError message={error} sessionExpired={sessionExpired} />}
```

(The `</div>` shown above is the existing closing tag of the Enabled/Retention flex container — do not add a second one; this snippet shows the intended ordering around the moved block.)

- [ ] **Step 4: Add the PD submit gate**

In `template-form.tsx`, just before the `return (`, add a derived guard:

```tsx
  const pdIncomplete =
    !isEdit &&
    observationClass === 'phantom_demand' &&
    scope.kind === 'phantom_demand' &&
    (scope.counterparty.length === 0 || scope.skus.length === 0);
```

Then change the Create/Save button's `disabled` prop from:

```tsx
          disabled={busy || name.length === 0}
```

to:

```tsx
          disabled={busy || name.length === 0 || pdIncomplete}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run:
```
npx vitest run src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx
```
Expected: PASS — all template-form tests, including the two new ones. (The existing 401/400 error tests still pass — they exercise audit mode which is unaffected by `pdIncomplete`.)

- [ ] **Step 6: Commit**

```
cd /c/Users/SamFleming/HaiWeb
git add src/app/account/sonar/templates/_components/template-form.tsx src/app/account/sonar/templates/_components/__tests__/template-form.test.tsx
git commit -m "feat(sonar): relocate scope picker below settings + PD submit gate"
```

---

### Task 7: Full verification (both repos)

**Files:** none (verification only).

- [ ] **Step 1: Protocol + haiCore touched tests**

Run (from `C:\Users\SamFleming\haiCore`):
```
npx vitest run packages/protocol/src/phantom-demand/__tests__/scope.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 2: HaiWeb — all new/changed component tests**

Run (from `C:\Users\SamFleming\HaiWeb`):
```
npx vitest run src/app/account/sonar/templates/_components/__tests__
```
Expected: PASS — counterparty-picker (4), partner-sku-picker (5), phantom-demand-scope-fields (3), scope-picker (delegation + audit/watcher), template-form (existing + 2 new).

- [ ] **Step 3: HaiWeb typecheck (touched files clean)**

Run (from `C:\Users\SamFleming\HaiWeb`):
```
npx tsc --noEmit 2>&1 | grep -E "templates/_components|phantom-demand|counterparty-picker|partner-sku-picker|scope-picker|template-form" || echo "clean for touched files"
```
Expected: `clean for touched files` (pre-existing unrelated errors elsewhere are out of scope — do not fix them here).

- [ ] **Step 4: Manual smoke (live)**

Confirm dev servers are up (HaiWeb :3001, haiCore :3000). In a browser at
`http://localhost:3001/account/sonar/templates/new?observation_class=phantom_demand`:
- Field order is: Template name → Modality → Cadence → Enabled/Retention → (Quantity → Target Delivery Date → Counterparty → SKUs) → Create.
- Counterparty list shows only trading-pair partners (e.g. National Industrial Supply, MidWest Fastener, Great Lakes Hardware, Pacific Safety); search filters them.
- Selecting a partner loads its flat product list (National/MidWest have hundreds; type in the filter to narrow). Free-text "SKU I have in mind" adds a chip.
- "Create template" is disabled until a counterparty and ≥1 SKU are chosen; with both set + a name, submit succeeds and redirects to the new template detail page.
- If the catalog list is empty for a chosen partner, the free-text add still works and a single free-text SKU + counterparty + name still submits successfully (validates the relaxed schema end-to-end).

- [ ] **Step 5: Final commit (if any verification fixups were needed)**

```
cd /c/Users/SamFleming/HaiWeb
git add -A
git commit -m "test(sonar): verification fixups for PD config redesign"
```
(Skip if there were no fixups.)

---

## Self-Review

**Spec coverage:**
- D1 trading_pair only → Task 2 (filter `status === 'trading_pair'`, tests).
- D2 inline searchable list, single select → Task 2.
- D3 row fields name·industry·location·status → Task 2 component.
- D4 flat product list + free-text + chips, value = external_product_id → Task 3.
- D5 "Target Delivery Date" label-only, datetime-local, hypothetical_timeline → Task 4.
- D6 Approach 2 (new components, nominations untouched) → Tasks 2–5.
- D7 order Quantity→Date→Counterparty→SKUs → Task 4.
- D8 ScopePicker after Enabled/Retention, all modalities → Task 6.
- D9 counterparty change clears skus → Task 4 (component + test).
- D10 protocol skus relaxation + version bump + rebuild → Task 1.
- Validation: counterparty + ≥1 sku submit gate → Task 6.

**Placeholder scan:** No TBD/TODO; every code step contains complete code; every command has expected output. None found.

**Type consistency:** `PdScope = Extract<RunTemplateScope,{kind:'phantom_demand'}>` is used identically in Task 4 and Task 5. `CounterpartyPicker` props `{value:string,onChange:(id:string)=>void}` consumed consistently in Task 4. `PartnerSkuPicker` props `{counterpartyId:string,value:string[],onChange:(skus:string[])=>void}` consumed consistently in Task 4. BFF product path `/api/account/partners/{id}/catalog/products?page=1&size=500` matches the catalog products BFF route. `/api/account/partners` returns `{id,company_name,status,industry,location,...}` matching the picker's `PartnerRow`. Consistent.
