'use client';

import { useMemo, useState } from 'react';
import type { AuditRun, AuditRunResult, ObservationNode } from '@haiwave/protocol';
// Shared tier/score helpers — reused from the observations module, not
// re-declared. (The original products-grid.tsx, deleted in v.1.39, carried
// inline copies; they were later extracted to gap-tier.tsx in 4bc981d.)
import {
  tierBucket,
  scoreOf,
  mergeTiers,
  GapTierBar,
  ScorePill,
} from '@/components/sonar/observations';

// Bucket every gap in the subtree by tier (depth_level, clamped at 4+).
// Persisted result subtrees are rooted at a depth-1 child (the direct vendor),
// so depth_level maps directly to "Tier N".
function gapsByTier(
  node: ObservationNode,
  acc: Map<number, number> = new Map(),
): Map<number, number> {
  if (node.gap) {
    const t = tierBucket(node.depth_level);
    acc.set(t, (acc.get(t) ?? 0) + 1);
  }
  for (const c of node.components) gapsByTier(c, acc);
  return acc;
}

// v1.30: audit-specific fields (origin, product_id) live in the discriminated
// payload union. Read the vendor name through the audit branch.
function vendorNameOf(node: ObservationNode): string {
  return (
    node.vendor_legal_name ??
    (node.payload.kind === 'audit' ? node.payload.origin.vendor_name : null) ??
    ''
  );
}

// Vendor ordering for the queue. 'priority' surfaces the worst offenders first
// (the triage default); 'vendor' is an alphabetical lookup for "find this one
// company" — the two reasons a user scans a multi-vendor report.
type SortMode = 'priority' | 'vendor';

interface SkuRow {
  result: AuditRunResult;
  // product_id / vendor_participant_id are nullable on the protocol DTO (v.1.42
  // sub-tier identity-leak fix: withheld rows carry null). Normalise to '' here
  // so search/sort/grouping never trip over null.
  productId: string;
  vendorId: string;
  vendorName: string;
  gapTiers: Map<number, number>;
  score: number;
}

interface VendorGroup {
  key: string;
  vendorId: string;
  vendorName: string;
  skus: SkuRow[];
  gapTiers: Map<number, number>;
  score: number;
}

// One cell of the unified status bar. `hint` is the plain-English explanation
// of what the count actually represents — shown as a subtitle and a tooltip.
function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="flex flex-col gap-0.5" title={hint}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate">
        {label}
      </span>
      <span className="text-lg font-bold leading-tight text-charcoal">
        {value}
      </span>
      <span className="text-[10px] leading-tight text-slate">{hint}</span>
    </div>
  );
}

/**
 * Per-run tiered gap-scoring panel for the audit run-detail page (restored from
 * the v.1.39-deleted `products-grid.tsx`). Buckets every gap in each result
 * tree by supply-chain tier, weights it into a follow-up priority score
 * (T1×5/T2×3/T3×2/T4+×1), and groups SKUs under their tier-1 vendor.
 *
 * Also owns the unified run status bar (vendors / SKUs / depth / hops / gaps +
 * the weighted priority rollup) — folded in from the former SummaryStrip so the
 * page shows ONE status treatment instead of two stacked stat rows.
 */
export function TierGapGrid({
  run,
  results,
}: {
  run: AuditRun;
  results: AuditRunResult[];
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('priority');

  const rows = useMemo<SkuRow[]>(
    () =>
      results.map((r) => {
        const gapTiers = gapsByTier(r.tree);
        return {
          result: r,
          productId: r.product_id ?? '',
          vendorId: r.vendor_participant_id ?? '',
          vendorName: vendorNameOf(r.tree),
          gapTiers,
          score: scoreOf(gapTiers),
        };
      }),
    [results],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (e) =>
        e.productId.toLowerCase().includes(q) ||
        e.vendorName.toLowerCase().includes(q),
    );
  }, [rows, query]);

  // Group SKUs under their tier-1 (direct) vendor. SKUs within a vendor always
  // sort by their own follow-up score desc; the vendor ORDER is user-selected
  // (priority desc, or vendor name A–Z) via the Order-by control.
  const groups = useMemo<VendorGroup[]>(() => {
    const byVendor = new Map<string, VendorGroup>();
    for (const r of filtered) {
      const key = r.vendorId || `name:${r.vendorName}`;
      let g = byVendor.get(key);
      if (!g) {
        g = {
          key,
          vendorId: r.vendorId,
          vendorName: r.vendorName,
          skus: [],
          gapTiers: new Map(),
          score: 0,
        };
        byVendor.set(key, g);
      }
      g.skus.push(r);
      mergeTiers(g.gapTiers, r.gapTiers);
      g.score += r.score;
      if (!g.vendorName && r.vendorName) g.vendorName = r.vendorName;
    }
    const list = [...byVendor.values()];
    for (const g of list) {
      g.skus.sort(
        (a, b) => b.score - a.score || a.productId.localeCompare(b.productId),
      );
    }
    const byName = (a: VendorGroup, b: VendorGroup) =>
      (a.vendorName || a.vendorId).localeCompare(b.vendorName || b.vendorId);
    list.sort(
      sort === 'vendor'
        ? byName
        : (a, b) => b.score - a.score || byName(a, b),
    );
    return list;
  }, [filtered, sort]);

  // Run-wide rollup for the status bar's priority cell.
  const total = useMemo(() => {
    const tiers = new Map<number, number>();
    for (const r of rows) mergeTiers(tiers, r.gapTiers);
    return { tiers, score: scoreOf(tiers) };
  }, [rows]);

  const vendorCount = useMemo(
    () => new Set(rows.map((r) => r.vendorId || `name:${r.vendorName}`)).size,
    [rows],
  );
  const skuCount = useMemo(
    () => new Set(rows.map((r) => r.productId).filter(Boolean)).size,
    [rows],
  );

  const singleVendor = groups.length === 1;

  return (
    <section aria-labelledby="tier-gap-heading" className="space-y-4">
      <h2
        id="tier-gap-heading"
        className="font-[family-name:var(--font-display)] text-base font-bold text-navy"
      >
        Gaps by tier &amp; follow-up priority
      </h2>

      {/* Unified status bar — run-level counts + the weighted priority rollup,
          one treatment. Each cell states in plain English what it counts. */}
      <div
        aria-label="Run summary"
        className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-lg border border-slate/10 bg-slate-50 px-5 py-4"
      >
        <StatCell
          label="Vendors"
          value={vendorCount}
          hint="Direct (tier-1) vendors audited"
        />
        <StatCell
          label="SKUs"
          value={skuCount}
          hint="Products checked in this run"
        />
        <StatCell
          label="Depth"
          value={run.depth_limit}
          hint="Max supply-chain tiers traversed"
        />
        {run.hop_count !== null && run.hop_count !== undefined && (
          <StatCell
            label="Hops"
            value={run.hop_count}
            hint="Agent-to-agent calls made"
          />
        )}
        {run.gap_count !== null && run.gap_count !== undefined && (
          <StatCell
            label="Gaps"
            value={run.gap_count}
            hint="Tiers that couldn't be disclosed"
          />
        )}

        {/* Priority rollup — pushed to the far end, visually separated. */}
        <div className="flex flex-col gap-0.5 sm:ml-auto">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate">
            Follow-up priority
          </span>
          <span className="flex items-center gap-2">
            <GapTierBar tiers={total.tiers} />
            <ScorePill score={total.score} tiers={total.tiers} />
          </span>
          <span
            className="text-[10px] leading-tight text-slate"
            title="Gaps weighted by how reachable they are: tier 1 ×5, tier 2 ×3, tier 3 ×2, tier 4+ ×1. Higher = more worth chasing."
          >
            Weighted by tier (T1×5 · T2×3 · T3×2 · T4+×1)
          </span>
        </div>
      </div>

      {/* Search + Order-by share one row — they're both "find a vendor" tools,
          and search doesn't need the full width. */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product or vendor"
          aria-label="Search by product or vendor"
          className="min-w-[200px] flex-1 rounded border border-slate/20 px-3 py-1.5 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
        <label className="flex items-center gap-2 text-xs text-slate">
          <span className="whitespace-nowrap">Order by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            aria-label="Order vendors by"
            className="rounded border border-slate/20 bg-white px-2 py-1.5 text-sm text-charcoal focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
          >
            <option value="priority">Follow-up priority</option>
            <option value="vendor">Vendor (A–Z)</option>
          </select>
        </label>
        <span className="whitespace-nowrap text-xs text-slate">
          {groups.length} {groups.length === 1 ? 'vendor' : 'vendors'} ·{' '}
          {filtered.length} SKUs
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded border border-slate/15 py-8 text-center text-sm text-slate">
          {query
            ? 'No products match your search.'
            : 'No results recorded for this run.'}
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g, idx) => (
            <details
              key={g.key}
              open={singleVendor}
              className="group rounded border border-slate/15 bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-light-gray/50">
                <span className="text-slate transition-transform group-open:rotate-90">
                  ▸
                </span>
                {/* Rank index only reads as a ranking under priority order. */}
                {!singleVendor && sort === 'priority' && (
                  <span className="text-xs font-semibold tabular-nums text-slate">
                    #{idx + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-charcoal">
                    {g.vendorName || g.vendorId || 'Withheld vendor'}
                  </span>
                  <span className="ml-2 text-xs text-slate">
                    {g.skus.length} {g.skus.length === 1 ? 'SKU' : 'SKUs'}
                  </span>
                </span>
                <GapTierBar tiers={g.gapTiers} />
                <ScorePill score={g.score} tiers={g.gapTiers} />
              </summary>
              <ul className="divide-y divide-slate/10 border-t border-slate/10">
                {g.skus.map((r) => (
                  <li
                    key={r.result.result_id}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span className="font-mono text-charcoal">
                      {r.productId || '—'}
                    </span>
                    <span className="flex items-center gap-2">
                      <GapTierBar tiers={r.gapTiers} />
                      <ScorePill score={r.score} tiers={r.gapTiers} />
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
