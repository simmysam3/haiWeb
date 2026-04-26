# Least Compliant Partners Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Least compliant partners" panel to the audit dashboard that ranks Tier-1 trading partners by count of non-US (incl. `<unknown>`) components in their full audit subtrees, with summary stats (total vendors, total non-compliant, median per vendor) and top-25 horizontal bars.

**Architecture:** Server-side aggregation in HaiWeb's BFF page component using the existing `/api/account/audit-runs/{id}/results` payload — no backend or protocol changes. A pure function (`buildPartnerCompliance`) folds `AuditRunResult.geo_rollup` entries by `vendor_participant_id`, with `scope_snapshot.resolved_products` providing the denominator for total-vendor and median stats. A presentational client component (`PartnersChart`) renders the result with recharts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, recharts 3, Tailwind CSS 4, Vitest 4 + @testing-library, `@haiwave/protocol` for shared types.

**Spec:** `HaiWeb/docs/superpowers/specs/2026-04-26-least-compliant-partners-chart-design.md`

---

## Conventions (apply to every task)

- All paths in this plan are relative to `C:/Users/SamFleming/HaiWeb/`.
- Test file convention: tests live under a `__tests__/` subdirectory next to the file under test (matches existing `src/lib/__tests__/`).
- Run tests with `npm run test -- <path-pattern>` (vitest in run-once mode). Use `npm run test:watch` while iterating locally.
- Type checks live in `npm run build` (Next.js runs tsc as part of build) — run after major TS changes.
- Commit messages follow conventional commits: `feat:` for new features, `test:` for test-only changes.
- Each commit step uses `git add` with explicit paths, never `git add .` or `git add -A`.

---

## File Structure

**Create:**
- `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts` — pure aggregation function + types.
- `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts` — vitest coverage of the aggregator.
- `src/app/account/monitoring/audits/dashboard/partners-chart.tsx` — `'use client'` presentational component.

**Modify:**
- `src/app/account/monitoring/audits/dashboard/page.tsx` — extend `DashboardData`, call `buildPartnerCompliance()`, render `<PartnersChart />`.

---

## Task 1: Scaffold types, stub aggregator, and failing-test setup

**Files:**
- Create: `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts`
- Create: `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`

- [ ] **Step 1: Create the aggregator module with types and a stub**

Create `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts`:

```ts
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';

export interface PartnerRow {
  vendor_participant_id: string;
  vendor_legal_name: string | null;
  non_compliant_count: number;
}

export interface PartnerComplianceData {
  rows: PartnerRow[];
  total_vendors_in_scope: number;
  total_non_compliant: number;
  median_per_vendor: number;
}

export function buildPartnerCompliance(
  _latestRun: AuditRun,
  _results: AuditRunResult[],
): PartnerComplianceData {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Create the test scaffold**

Create `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { AuditRun, AuditRunResult, AuditTraversalNode, GeoRollupEntry } from '@haiwave/protocol';
import { buildPartnerCompliance } from '../partner-compliance';

const VENDOR_A = '11111111-1111-1111-1111-111111111111';
const VENDOR_B = '22222222-2222-2222-2222-222222222222';
const VENDOR_C = '33333333-3333-3333-3333-333333333333';
const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUDITOR_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeRun(vendorIds: string[]): AuditRun {
  return {
    run_id: RUN_ID,
    auditor_participant_id: AUDITOR_ID,
    triggered_at: '2026-04-26T00:00:00.000Z',
    triggered_by_user_id: null,
    scope_snapshot: {
      scope_ids: [],
      resolved_products: vendorIds.map((vendor_id, i) => ({
        vendor_id,
        product_id: `prod-${i}`,
      })),
    },
    status: 'complete',
    completed_at: '2026-04-26T00:01:00.000Z',
    depth_limit: 5,
    hop_count: 1,
    gap_count: 0,
    error_message: null,
  };
}

function makeRollup(entries: Array<[string, number]>): GeoRollupEntry[] {
  return entries.map(([country_of_origin, component_count]) => ({
    country_of_origin,
    component_count,
    depth_distribution: {},
  }));
}

function makeTree(vendorLegalName: string | null): AuditTraversalNode {
  return {
    participant_id: null,
    vendor_legal_name: vendorLegalName,
    product_id: null,
    component_ref: null,
    internally_manufactured: true,
    origin: { tier: 'opaque' },
    operational_status: 'authorized',
    depth_level: 0,
    components: [],
    gap: null,
  };
}

function makeResult(args: {
  vendor_participant_id: string;
  product_id?: string;
  vendor_legal_name: string | null;
  rollup: GeoRollupEntry[];
}): AuditRunResult {
  return {
    result_id: `${args.vendor_participant_id}-${args.product_id ?? 'p'}`,
    run_id: RUN_ID,
    vendor_participant_id: args.vendor_participant_id,
    product_id: args.product_id ?? 'prod-x',
    tree: makeTree(args.vendor_legal_name),
    geo_rollup: args.rollup,
  };
}

describe('buildPartnerCompliance', () => {
  it('returns empty data shape for an empty run', () => {
    const run = makeRun([]);
    const data = buildPartnerCompliance(run, []);
    expect(data).toEqual({
      rows: [],
      total_vendors_in_scope: 0,
      total_non_compliant: 0,
      median_per_vendor: 0,
    });
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails with "not implemented"**

Run: `npm run test -- partner-compliance`
Expected: 1 failing test in `partner-compliance.test.ts` with message containing "not implemented".

- [ ] **Step 4: Replace the stub with a minimal real implementation that satisfies the empty case**

Replace the body of `buildPartnerCompliance` in `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts`:

```ts
export function buildPartnerCompliance(
  latestRun: AuditRun,
  _results: AuditRunResult[],
): PartnerComplianceData {
  const vendorIdsInScope = new Set(
    latestRun.scope_snapshot.resolved_products.map((p) => p.vendor_id),
  );
  return {
    rows: [],
    total_vendors_in_scope: vendorIdsInScope.size,
    total_non_compliant: 0,
    median_per_vendor: 0,
  };
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npm run test -- partner-compliance`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts \
        src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts
git commit -m "feat(audit-dashboard): scaffold partner-compliance aggregator"
```

---

## Task 2: Count non-US components from `geo_rollup` (US excluded, `<unknown>` counted)

**Files:**
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts`
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block in `partner-compliance.test.ts`:

```ts
  it('counts non-US components and excludes US (unknown counts as non-compliant)', () => {
    const run = makeRun([VENDOR_A]);
    const result = makeResult({
      vendor_participant_id: VENDOR_A,
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([
        ['US', 10],
        ['CN', 4],
        ['DE', 2],
        ['<unknown>', 3],
      ]),
    });
    const data = buildPartnerCompliance(run, [result]);
    expect(data.rows).toEqual([
      {
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'Acme Corp.',
        non_compliant_count: 9,
      },
    ]);
    expect(data.total_non_compliant).toBe(9);
  });
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm run test -- partner-compliance`
Expected: the new test fails (rows is currently always `[]`).

- [ ] **Step 3: Implement the per-result accumulator**

Replace the body of `buildPartnerCompliance` in `partner-compliance.ts`:

```ts
export function buildPartnerCompliance(
  latestRun: AuditRun,
  results: AuditRunResult[],
): PartnerComplianceData {
  const vendorIdsInScope = new Set(
    latestRun.scope_snapshot.resolved_products.map((p) => p.vendor_id),
  );

  const byVendor = new Map<
    string,
    { vendor_legal_name: string | null; non_compliant_count: number }
  >();

  for (const r of results) {
    const nonCompliant = r.geo_rollup.reduce(
      (sum, e) => (e.country_of_origin === 'US' ? sum : sum + e.component_count),
      0,
    );
    const existing = byVendor.get(r.vendor_participant_id);
    if (existing) {
      existing.non_compliant_count += nonCompliant;
      if (existing.vendor_legal_name === null && r.tree.vendor_legal_name) {
        existing.vendor_legal_name = r.tree.vendor_legal_name;
      }
    } else {
      byVendor.set(r.vendor_participant_id, {
        vendor_legal_name: r.tree.vendor_legal_name ?? null,
        non_compliant_count: nonCompliant,
      });
    }
  }

  const rows: PartnerRow[] = [];
  let total_non_compliant = 0;
  for (const [vendor_participant_id, v] of byVendor) {
    total_non_compliant += v.non_compliant_count;
    if (v.non_compliant_count > 0) {
      rows.push({
        vendor_participant_id,
        vendor_legal_name: v.vendor_legal_name,
        non_compliant_count: v.non_compliant_count,
      });
    }
  }

  return {
    rows,
    total_vendors_in_scope: vendorIdsInScope.size,
    total_non_compliant,
    median_per_vendor: 0,
  };
}
```

- [ ] **Step 4: Run all aggregator tests**

Run: `npm run test -- partner-compliance`
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts \
        src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts
git commit -m "feat(audit-dashboard): count non-US components per vendor"
```

---

## Task 3: Sum components across multiple results from the same vendor

**Files:**
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block:

```ts
  it('sums non-compliant counts when one vendor has multiple results', () => {
    const run = makeRun([VENDOR_A]);
    const r1 = makeResult({
      vendor_participant_id: VENDOR_A,
      product_id: 'prod-1',
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([['CN', 5], ['US', 2]]),
    });
    const r2 = makeResult({
      vendor_participant_id: VENDOR_A,
      product_id: 'prod-2',
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([['DE', 3], ['<unknown>', 1]]),
    });
    const data = buildPartnerCompliance(run, [r1, r2]);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({
      vendor_participant_id: VENDOR_A,
      non_compliant_count: 9, // 5 + 3 + 1
    });
  });
```

- [ ] **Step 2: Run the test — expect it to PASS already**

Run: `npm run test -- partner-compliance`
Expected: 3 passing tests. The accumulator from Task 2 already merges by vendor; this test locks the behavior in.

- [ ] **Step 3: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts
git commit -m "test(audit-dashboard): lock per-vendor result merging"
```

---

## Task 4: Use `scope_snapshot.resolved_products` for `total_vendors_in_scope`

**Files:**
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block:

```ts
  it('total_vendors_in_scope counts distinct vendors from scope_snapshot, not from results', () => {
    const run = makeRun([VENDOR_A, VENDOR_B, VENDOR_C, VENDOR_C]); // duplicate vendor in scope (different products)
    const result = makeResult({
      vendor_participant_id: VENDOR_A,
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([['CN', 1]]),
    });
    const data = buildPartnerCompliance(run, [result]);
    expect(data.total_vendors_in_scope).toBe(3); // A, B, C — duplicates collapse
  });
```

- [ ] **Step 2: Run the test — expect it to PASS already**

Run: `npm run test -- partner-compliance`
Expected: 4 passing tests. The Set-based denominator from Task 2 already enforces this.

- [ ] **Step 3: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts
git commit -m "test(audit-dashboard): lock scope-snapshot denominator"
```

---

## Task 5: Median across all in-scope vendors (including zeros)

**Files:**
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts`
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`

- [ ] **Step 1: Add three failing tests covering median odd, even, and zero-vendors**

Append inside the `describe` block:

```ts
  it('median (odd in-scope count) is the middle value across all in-scope vendors, zeros included', () => {
    const run = makeRun([VENDOR_A, VENDOR_B, VENDOR_C]);
    // A: 10 non-compliant, B: 4 non-compliant, C: no result -> 0
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'A',
        rollup: makeRollup([['CN', 10]]),
      }),
      makeResult({
        vendor_participant_id: VENDOR_B,
        vendor_legal_name: 'B',
        rollup: makeRollup([['DE', 4]]),
      }),
    ]);
    // Sorted [0, 4, 10] -> median 4
    expect(data.median_per_vendor).toBe(4);
  });

  it('median (even in-scope count) is the average of the two middle values', () => {
    const run = makeRun([VENDOR_A, VENDOR_B, VENDOR_C, '44444444-4444-4444-4444-444444444444']);
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'A',
        rollup: makeRollup([['CN', 8]]),
      }),
      makeResult({
        vendor_participant_id: VENDOR_B,
        vendor_legal_name: 'B',
        rollup: makeRollup([['DE', 4]]),
      }),
      // C, D: no results -> 0, 0
    ]);
    // Sorted [0, 0, 4, 8] -> median (0 + 4) / 2 = 2
    expect(data.median_per_vendor).toBe(2);
  });

  it('vendors in scope without a result are excluded from rows but contribute 0 to the median set', () => {
    const run = makeRun([VENDOR_A, VENDOR_B]);
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'A',
        rollup: makeRollup([['CN', 6]]),
      }),
    ]);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].vendor_participant_id).toBe(VENDOR_A);
    // Sorted [0, 6] -> median (0 + 6) / 2 = 3
    expect(data.median_per_vendor).toBe(3);
  });
```

- [ ] **Step 2: Run the tests to confirm three new failures**

Run: `npm run test -- partner-compliance`
Expected: 3 new failing tests asserting `median_per_vendor` values (4, 2, 3); the function still returns 0.

- [ ] **Step 3: Add a `computeMedian` helper and use it**

Edit `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts`. Add this helper above `buildPartnerCompliance`:

```ts
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}
```

Replace the `return` at the end of `buildPartnerCompliance` with median computation that includes zeros for vendors in scope without results:

```ts
  const allCounts: number[] = [];
  for (const vendorId of vendorIdsInScope) {
    const v = byVendor.get(vendorId);
    allCounts.push(v ? v.non_compliant_count : 0);
  }

  return {
    rows,
    total_vendors_in_scope: vendorIdsInScope.size,
    total_non_compliant,
    median_per_vendor: computeMedian(allCounts),
  };
```

(Replace the existing `return { ... median_per_vendor: 0 }` block with the above.)

- [ ] **Step 4: Run the tests**

Run: `npm run test -- partner-compliance`
Expected: 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts \
        src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts
git commit -m "feat(audit-dashboard): compute median non-compliant per vendor"
```

---

## Task 6: Sort rows descending by count, then ascending by name on ties

**Files:**
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts`
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block:

```ts
  it('sorts rows descending by non_compliant_count, then ascending by vendor_legal_name on ties', () => {
    const run = makeRun([VENDOR_A, VENDOR_B, VENDOR_C]);
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'Zeta',
        rollup: makeRollup([['CN', 5]]),
      }),
      makeResult({
        vendor_participant_id: VENDOR_B,
        vendor_legal_name: 'Alpha',
        rollup: makeRollup([['DE', 5]]),
      }),
      makeResult({
        vendor_participant_id: VENDOR_C,
        vendor_legal_name: 'Beta',
        rollup: makeRollup([['CN', 10]]),
      }),
    ]);
    expect(data.rows.map((r) => r.vendor_legal_name)).toEqual([
      'Beta',  // 10
      'Alpha', // 5 (ties resolved by name asc)
      'Zeta',  // 5
    ]);
  });
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm run test -- partner-compliance`
Expected: the new test fails — current order is insertion order (Zeta, Alpha, Beta).

- [ ] **Step 3: Sort rows before returning**

Edit `partner-compliance.ts`. Locate where `rows` is built and add a sort right after the loop that pushes into `rows` (before constructing the return value):

```ts
  rows.sort((a, b) => {
    if (b.non_compliant_count !== a.non_compliant_count) {
      return b.non_compliant_count - a.non_compliant_count;
    }
    const an = a.vendor_legal_name ?? '';
    const bn = b.vendor_legal_name ?? '';
    return an.localeCompare(bn);
  });
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -- partner-compliance`
Expected: 8 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/_lib/partner-compliance.ts \
        src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts
git commit -m "feat(audit-dashboard): sort partner rows by count desc, name asc"
```

---

## Task 7: Fall back to truncated UUID when `vendor_legal_name` is null

**Files:**
- Modify: `src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside the `describe` block:

```ts
  it('keeps vendor_legal_name as null in the row when no result provided one', () => {
    const run = makeRun([VENDOR_A]);
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: null,
        rollup: makeRollup([['CN', 2]]),
      }),
    ]);
    expect(data.rows[0]).toEqual({
      vendor_participant_id: VENDOR_A,
      vendor_legal_name: null,
      non_compliant_count: 2,
    });
  });
```

- [ ] **Step 2: Run the test — expect it to PASS already**

Run: `npm run test -- partner-compliance`
Expected: 9 passing tests. (The aggregator preserves null; the chart component does the truncated-UUID fallback at render time.)

- [ ] **Step 3: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/_lib/__tests__/partner-compliance.test.ts
git commit -m "test(audit-dashboard): lock null vendor_legal_name pass-through"
```

---

## Task 8: Build the `PartnersChart` client component

**Files:**
- Create: `src/app/account/monitoring/audits/dashboard/partners-chart.tsx`

- [ ] **Step 1: Create the component**

Create `src/app/account/monitoring/audits/dashboard/partners-chart.tsx`:

```tsx
'use client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Panel } from '@/components';
import type { PartnerComplianceData, PartnerRow } from './_lib/partner-compliance';

const TOP_N = 25;
const ROW_HEIGHT_PX = 24;

function displayName(row: PartnerRow): string {
  return row.vendor_legal_name ?? `${row.vendor_participant_id.slice(0, 8)}…`;
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate">{label}</span>
      <span className="text-2xl font-semibold text-charcoal">{value}</span>
    </div>
  );
}

export function PartnersChart({ data }: { data: PartnerComplianceData | null }) {
  if (data === null) {
    return (
      <Panel className="p-4">
        <h2 className="text-sm font-medium text-charcoal mb-3">Least compliant partners</h2>
        <p className="text-sm text-slate">
          No audit data yet. Run an audit to populate the dashboard.
        </p>
      </Panel>
    );
  }

  const visibleRows = data.rows.slice(0, TOP_N).map((r) => ({
    ...r,
    display_name: displayName(r),
  }));

  return (
    <Panel className="p-4">
      <h2 className="text-sm font-medium text-charcoal mb-3">Least compliant partners</h2>

      <div className="grid grid-cols-3 gap-4 pb-3 mb-3 border-b border-slate/15">
        <StatItem label="Total vendors" value={data.total_vendors_in_scope} />
        <StatItem label="Total non-compliant" value={data.total_non_compliant} />
        <StatItem label="Median per vendor" value={data.median_per_vendor} />
      </div>

      {data.total_non_compliant === 0 ? (
        <p className="text-sm text-slate text-center py-8">All vendors compliant.</p>
      ) : (
        <ResponsiveContainer
          width="100%"
          height={Math.max(140, visibleRows.length * ROW_HEIGHT_PX)}
        >
          <BarChart data={visibleRows} layout="vertical" margin={{ left: 60 }}>
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="display_name"
              tickLine={false}
              axisLine={false}
              width={160}
            />
            <Tooltip formatter={(v) => `${v ?? 0} non-compliant components`} />
            <Bar
              dataKey="non_compliant_count"
              fill="var(--color-orange)"
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
            />
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-slate italic mt-3">* Non US Based Components</p>
    </Panel>
  );
}
```

- [ ] **Step 2: Verify the file type-checks**

Run: `npm run build`
Expected: build succeeds. If TypeScript complains about recharts/JSX, stop and investigate — do not silence with `any`.

- [ ] **Step 3: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/partners-chart.tsx
git commit -m "feat(audit-dashboard): add PartnersChart client component"
```

---

## Task 9: Wire the chart into the dashboard page

**Files:**
- Modify: `src/app/account/monitoring/audits/dashboard/page.tsx`

- [ ] **Step 1: Extend `DashboardData` and call the aggregator**

Edit `src/app/account/monitoring/audits/dashboard/page.tsx`. Apply these changes:

1. Add imports near the top of the file (after the existing imports):

```ts
import { PartnersChart } from './partners-chart';
import { buildPartnerCompliance, type PartnerComplianceData } from './_lib/partner-compliance';
```

2. Update the `DashboardData` interface:

```ts
interface DashboardData {
  rollup: GeoRollupEntry[];
  gaps: number | null;
  latestAt: string | null;
  partnerCompliance: PartnerComplianceData | null;
}
```

3. Update each `return` inside `loadDashboard()` to include `partnerCompliance`:

   - The early return when `runsRes` is null:
     ```ts
     if (!runsRes) return { rollup: [], gaps: null, latestAt: null, partnerCompliance: null };
     ```
   - The early return when no completed/partial run is found:
     ```ts
     if (!latest) return { rollup: [], gaps: null, latestAt: null, partnerCompliance: null };
     ```
   - The early return when results fetch fails:
     ```ts
     if (!resultsRes) {
       return {
         rollup: [],
         gaps: latest.gap_count ?? 0,
         latestAt: latest.triggered_at,
         partnerCompliance: null,
       };
     }
     ```
   - The final return — add the partner aggregation after the existing geo-rollup merge:
     ```ts
     return {
       rollup: [...merged.values()].sort(
         (a, b) => b.component_count - a.component_count,
       ),
       gaps: latest.gap_count ?? 0,
       latestAt: latest.triggered_at,
       partnerCompliance: buildPartnerCompliance(latest, resultsRes.results),
     };
     ```

4. Render `<PartnersChart>` in the JSX. After the closing `</div>` of the `grid grid-cols-1 lg:grid-cols-2 gap-6` container (and before the closing `</div>` of the outer `p-6 space-y-6` wrapper), add:

```tsx
      <PartnersChart data={data.partnerCompliance} />
```

- [ ] **Step 2: Run the build to confirm types**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the existing 9 partner-compliance tests.

- [ ] **Step 4: Commit**

```bash
git add src/app/account/monitoring/audits/dashboard/page.tsx
git commit -m "feat(audit-dashboard): render PartnersChart on dashboard"
```

---

## Task 10: Manual verification in dev server

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Next dev server boots on port 3001.

- [ ] **Step 2: Sign in and navigate to the audit dashboard**

In a browser, go to `http://localhost:3001/account/monitoring/audits/dashboard`. Sign in if prompted (see `project_haiweb_dev_auth.md` in user memory if mutations 401: ensure `DEV_KEYCLOAK_TOKEN=true` in `.env.local`).

- [ ] **Step 3: Verify the new panel renders**

Confirm visually:
- "Least compliant partners" panel appears below the geo chart + gaps panel row, full width.
- Stats strip shows three numbers (Total vendors / Total non-compliant / Median per vendor).
- Top-25 horizontal bars are present, narrow, sorted descending, orange fill.
- Footnote at the bottom: "* Non US Based Components".
- Hovering a bar shows a tooltip "{N} non-compliant components".

- [ ] **Step 4: Verify the empty / zero states**

If no audit has run, confirm the panel shows the "No audit data yet" message instead of stats. If a run exists but every vendor is 100% US-compliant, confirm the panel shows the stats strip with zeros and an "All vendors compliant" message in place of the bar chart. (If the current dev data doesn't naturally produce these states, skip and note as untested in the PR description.)

- [ ] **Step 5: Stop the dev server**

Ctrl-C the running `npm run dev`.

- [ ] **Step 6: No commit needed** (verification only). If any visual issues were found, return to the relevant earlier task instead of patching here.

---

## Self-Review Notes

1. **Spec coverage:**
   - Tier-1 attribution + full-subtree rollup → Task 2 (uses `geo_rollup`, which already aggregates the entire subtree).
   - Strict non-compliance (US excluded, `<unknown>` counted) → Task 2.
   - Stats use full audit-scope denominator → Task 4 (denominator) + Task 5 (median).
   - Top 25 / narrow bars / separate row / orange fill → Task 8.
   - No protocol changes → confirmed; only `@haiwave/protocol` types are imported.
   - Sort order with stable secondary sort → Task 6.
   - Null `vendor_legal_name` fallback → Task 7 (aggregator preserves null) + Task 8 (`displayName` truncates UUID).
   - Edge states (no run / all compliant / vendor without result) → Tasks 5, 8, and 10.

2. **Placeholder scan:** No "TBD"/"TODO" or "add appropriate X" steps. All code blocks are complete.

3. **Type consistency:** `PartnerComplianceData`, `PartnerRow`, `buildPartnerCompliance` names are stable from Task 1 through Task 9. `displayName` and `StatItem` are local to the chart component.

4. **One nuance worth flagging:** Tasks 3, 4, and 7 are characterization tests — they assert behavior already implemented in earlier tasks. They're included to lock invariants in the test suite (the spec explicitly calls for them) and to give the reviewer confidence the aggregator handles each case. The "expect it to PASS already" annotation tells the implementer not to chase a failure.
