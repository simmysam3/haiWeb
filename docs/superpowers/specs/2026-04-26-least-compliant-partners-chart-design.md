# Least Compliant Partners Chart — Design

**Date:** 2026-04-26
**Status:** Approved (design)
**Repo:** HaiWeb
**Route:** `/account/monitoring/audits/dashboard`

## Summary

Add a third panel to the audit dashboard that ranks Tier-1 trading partners by the count of non-compliant components (where "non-compliant" means non-US country of origin, including `<unknown>`) appearing anywhere in their full audit subtrees. Top 25 partners shown as a horizontal bar chart, with summary stats above it.

## Goal

Give the operator a procurement-oriented view of which direct partners contribute the most foreign-sourced content. Complements the existing "Components by country" chart (which aggregates across the network) by attributing the count to specific Tier-1 vendors so the operator knows whom to follow up with.

## Non-goals

- Component-level drill-in. Click-through to a partner's detail view is out of scope for this iteration.
- Compliance frameworks beyond "US vs non-US country of origin." If/when other rules are added, the footnote and aggregation will need to evolve.
- Backend changes. All aggregation runs in the existing BFF page server component using data already returned by `/api/account/audit-runs/{id}/results`.

## Key decisions

1. **Tier-1 attribution, full-subtree rollup.** A partner's count includes non-compliant components from sub-tier suppliers. If three sub-components of a Tier-1 vendor's product are non-US, that adds 3 to the Tier-1 vendor's count. Decision rationale: this matches how procurement teams think about accountability — the direct partner owns its supply chain.
2. **Strict definition of non-compliant.** Anything that isn't an explicit ISO-2 `US` is counted, including the `<unknown>` sentinel that appears for gaps (non-participants, unauthorized, depth-limited, agent-offline). Rationale: "if you can't prove it's US, it's not compliant" matches the conservative regulatory posture the dashboard implies.
3. **Top 25, narrow bars, separate row.** Same horizontal bar pattern as the geo chart, but `maxBarSize=14` (vs 28 on the geo chart) to keep the panel compact even at 25 rows. Sits in its own full-width row below the existing 2-up grid so it doesn't squeeze the other panels.
4. **Stats use full audit-scope denominator.** Total vendors and median per vendor are computed across all Tier-1 vendors in the audit's `scope_snapshot.resolved_products`, not just those who appear in results or the chart. A vendor with zero non-compliances counts toward the denominator and contributes a 0 to the median set.
5. **No protocol changes.** The aggregated shape is HaiWeb-local. The chart is purely a UI rollup of fields already on the wire (`vendor_participant_id`, `tree.vendor_legal_name`, `geo_rollup`, `scope_snapshot.resolved_products`).

## Architecture

### Files

```
HaiWeb/src/app/account/monitoring/audits/dashboard/
├── page.tsx                              # extended to compute + pass partner data
├── geo-chart.tsx                         # unchanged
├── gaps-panel.tsx                        # unchanged
├── run-controls.tsx                      # unchanged
├── partners-chart.tsx                    # NEW — client component, presentational
└── _lib/
    ├── partner-compliance.ts             # NEW — server-only aggregation
    └── __tests__/
        └── partner-compliance.test.ts    # NEW — vitest coverage of aggregation
```

### Types (HaiWeb-local)

Defined in `_lib/partner-compliance.ts` and re-exported for the client component:

```ts
export interface PartnerRow {
  vendor_participant_id: string;
  vendor_legal_name: string | null;
  non_compliant_count: number;
}

export interface PartnerComplianceData {
  rows: PartnerRow[];                // all vendors with count > 0, sorted desc by count then by name; chart slices to top 25
  total_vendors_in_scope: number;    // distinct vendors from scope_snapshot.resolved_products
  total_non_compliant: number;       // sum of non-US components across the run
  median_per_vendor: number;         // median across ALL in-scope vendors (incl. zeros)
}
```

### Aggregation logic (`_lib/partner-compliance.ts`)

```ts
buildPartnerCompliance(latestRun: AuditRun, results: AuditRunResult[]): PartnerComplianceData
```

1. Build `vendorIdsInScope` = `new Set(latestRun.scope_snapshot.resolved_products.map(p => p.vendor_id))`. This is the denominator.
2. For each result in `results`:
   - Compute `nonCompliantForResult` = sum of `entry.component_count` for every `entry` in `result.geo_rollup` where `entry.country_of_origin !== 'US'`.
   - Accumulate into a `Map<vendor_participant_id, { name: string | null; count: number }>`. On first sight, capture `result.tree.vendor_legal_name` for the name.
3. Initialize per-vendor counts for any vendor in `vendorIdsInScope` that didn't appear in results — they contribute a 0 to the median set.
4. Build the full per-vendor count array (all in-scope vendors, including zeros) → compute median.
5. Filter to count > 0, sort descending by `non_compliant_count` then ascending by `vendor_legal_name` for stable display, return as `rows`.
6. `total_non_compliant` = sum across all vendors.
7. `total_vendors_in_scope` = `vendorIdsInScope.size`.

### `dashboard/page.tsx` integration

Extend `DashboardData` with `partnerCompliance: PartnerComplianceData | null`. Compute it in `loadDashboard()` after the existing geo rollup merge, using the same `latest` run and `resultsRes.results`. Pass to a new `<PartnersChart data={data.partnerCompliance} />` rendered in a full-width row beneath the existing 2-column grid:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <GeoChart data={data.rollup} />
  <GapsPanel totalGaps={data.gaps} latestAt={data.latestAt} />
</div>
<PartnersChart data={data.partnerCompliance} />
```

### `partners-chart.tsx` (client component)

`'use client'`. Receives `{ data: PartnerComplianceData | null }`. Renders inside a `<Panel>`:

- **Title:** `<h2 className="text-sm font-medium text-charcoal mb-3">Least compliant partners</h2>`
- **Stats strip:** three flex items below the title.
  - Total vendors / Total non-compliant / Median per vendor
  - Number: `text-2xl font-semibold text-charcoal`
  - Label: `text-xs text-slate uppercase tracking-wide`
  - Border-bottom separator beneath the strip.
- **Bar chart:** recharts `ResponsiveContainer` with `height={Math.max(140, Math.min(rows.length, 25) * 24)}`, `BarChart layout="vertical" margin={{ left: 60 }}`, `XAxis type="number"` numeric, `YAxis type="category" dataKey="vendor_legal_name" width={160}`, `Bar dataKey="non_compliant_count" radius={[0, 4, 4, 0]} maxBarSize={14}` filled with `var(--color-orange)`. Tooltip formatter: `(v) => \`${v} non-compliant components\``. Long names truncate via Y-axis defaults; full name surfaces in tooltip.
- **Footnote:** `<p className="text-xs text-slate italic mt-3">* Non US Based Components</p>`.

### Empty / edge states

| Condition | Behavior |
|---|---|
| `data === null` (no audit run completed yet) | Title + "No audit data yet. Run an audit to populate the dashboard." Stats and bars hidden. |
| `data.total_non_compliant === 0` | Title + stats strip showing zeros + centered "All vendors compliant" message in place of the bar chart. Footnote still rendered. |
| Vendor in scope without a result | Counts as 0; included in `total_vendors_in_scope`, contributes 0 to median, not shown as a bar. |
| `tree.vendor_legal_name` null/missing | Display name = first 8 chars of `vendor_participant_id`. |
| Long vendor name | Truncated by Y-axis; full name shown in tooltip. |
| Fewer than 25 non-compliant vendors | All shown; cap is a maximum, not a target. |
| More than 25 non-compliant vendors | Only top 25 shown; `total_non_compliant` and `total_vendors_in_scope` still reflect the full run. |

## Testing

`_lib/__tests__/partner-compliance.test.ts` covers the aggregation function. The chart component is presentational and not tested.

| # | Case | Assertion |
|---|---|---|
| 1 | Two results from the same vendor (different products) | One `PartnerRow` for that vendor with summed `non_compliant_count` |
| 2 | `<unknown>` country in `geo_rollup` | Counted as non-compliant |
| 3 | `US` country in `geo_rollup` | Excluded from `non_compliant_count` |
| 4 | Vendor in `scope_snapshot.resolved_products` but no result returned | Excluded from `rows`; counted in `total_vendors_in_scope`; contributes 0 to median set |
| 5 | `total_vendors_in_scope` source | Equals distinct `vendor_id` count from `scope_snapshot.resolved_products`, not `results.length` |
| 6a | Median with odd in-scope count | Returns the middle value |
| 6b | Median with even in-scope count | Returns the average of the two middle values |
| 7 | Tied counts | Sorted descending by count, then ascending by `vendor_legal_name` for deterministic order |
| 8 | Null `vendor_legal_name` | Falls back to first 8 chars of UUID for display name |

## Out of scope (future work)

- Click-through from a partner row to a per-partner audit detail view.
- Per-product breakdown when a partner has multiple products in scope.
- Compliance dimensions beyond country-of-origin (e.g., certifications, sanctions screening).
- Trend over time — comparing this run's partner ranking against a previous run.
