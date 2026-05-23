'use client';

import { useMemo, useState } from 'react';
import type { AuditRunResult, ObservationNode, AuditGapKind } from '@haiwave/protocol';
import { DataTable, type Column, Drawer } from '@/components';
import { IdChip } from '@/components/id-chip';
import { TreeView } from './tree-view';

const GAP_KIND_LABEL: Record<AuditGapKind, string> = {
  non_participant: 'Non-participant',
  agent_offline: 'Agent offline',
  unauthorized: 'Unauthorized',
  depth_limited: 'Depth limit',
};

// Tier 4 is a rollup bucket: every gap at depth_level >= 4 collapses into it.
// Deep sub-tier gaps are individually low-signal for follow-up, so they share
// one "4+" segment / one point each rather than sprawling the bar.
const MAX_TIER = 4;
function tierBucket(depthLevel: number): number {
  return Math.min(Math.max(depthLevel, 1), MAX_TIER);
}
function tierLabel(tier: number): string {
  return tier >= MAX_TIER ? `${MAX_TIER}+` : String(tier);
}

// Follow-up urgency weighting. A shallow gap is far more actionable than a
// deep one — a tier-1 vendor that won't disclose is your problem to chase;
// a tier-4 sub-supplier gap is mostly informational. Weights chosen by the
// product owner: T1=5, T2=3, T3=2, T4+=1 point each.
const TIER_POINTS: Record<number, number> = { 1: 5, 2: 3, 3: 2, 4: 1 };
function tierPoints(tier: number): number {
  return TIER_POINTS[tier] ?? 1;
}

// Bucket every gap in the subtree by tier (depth_level, clamped at 4+).
// Persisted result subtrees are rooted at a depth-1 child (the direct
// vendor), so depth_level maps directly to "Tier N".
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

function scoreOf(tiers: Map<number, number>): number {
  let pts = 0;
  for (const [tier, count] of tiers) pts += count * tierPoints(tier);
  return pts;
}

function mergeTiers(into: Map<number, number>, from: Map<number, number>): void {
  for (const [tier, count] of from) into.set(tier, (into.get(tier) ?? 0) + count);
}

// Lowest (shallowest) tier with a gap — drives the severity colour of the
// score pill so the most urgent offenders read hottest.
function worstTier(tiers: Map<number, number>): number | null {
  let min: number | null = null;
  for (const t of tiers.keys()) min = min === null ? t : Math.min(min, t);
  return min;
}

// Severity shading by tier: tier 1 dominates (problem-red), tier 2 amber,
// tier 3 slate, tier 4+ muted — so the eye lands on the shallowest gaps.
const TIER_STYLE: Record<number, { bg: string; text: string }> = {
  1: { bg: 'bg-[var(--color-problem)]/15', text: 'text-[var(--color-problem)]' },
  2: { bg: 'bg-amber-100', text: 'text-amber-700' },
  3: { bg: 'bg-slate-100', text: 'text-slate-600' },
  4: { bg: 'bg-slate-50', text: 'text-slate-400' },
};
function tierStyle(tier: number): { bg: string; text: string } {
  return TIER_STYLE[tier] ?? TIER_STYLE[MAX_TIER];
}

// "Nothing to view" when the root node has a gap and no components — the
// audit was blocked or pruned at the very top, so opening the drawer would
// just show an empty tree. Surface the gap reason in place of the action.
function rootBlockingGap(node: ObservationNode): AuditGapKind | null {
  if (node.gap && node.components.length === 0) return node.gap.kind;
  return null;
}

// Segmented pill: one cell per tier from 1..deepest-gapped tier. Intermediate
// tiers with no gaps render dimmed (the chain is clean at that level) rather
// than dropped, so the depth at which problems appear stays legible. No gaps
// anywhere → an em-dash.
function GapTierBar({ tiers }: { tiers: Map<number, number> }) {
  if (tiers.size === 0) return <span className="text-slate">—</span>;
  const maxTier = Math.max(...tiers.keys());
  const segments: { tier: number; count: number }[] = [];
  for (let t = 1; t <= maxTier; t++) {
    segments.push({ tier: t, count: tiers.get(t) ?? 0 });
  }
  const title = segments
    .map((s) => `Tier ${tierLabel(s.tier)}: ${s.count}`)
    .join(' · ');
  return (
    <span
      className="inline-flex overflow-hidden rounded border border-slate/15 text-[11px] font-medium"
      title={title}
    >
      {segments.map((s, i) => {
        const dim = s.count === 0;
        const st = tierStyle(s.tier);
        return (
          <span
            key={s.tier}
            className={`px-1.5 py-0.5 tabular-nums ${
              i > 0 ? 'border-l border-slate/15' : ''
            } ${dim ? 'bg-transparent text-slate-300' : `${st.bg} ${st.text}`}`}
            aria-label={`Tier ${tierLabel(s.tier)}: ${s.count}`}
          >
            {s.count}
          </span>
        );
      })}
    </span>
  );
}

function ScorePill({ score, tiers }: { score: number; tiers: Map<number, number> }) {
  if (score === 0) return <span className="text-slate">0</span>;
  const wt = worstTier(tiers);
  const st = wt ? tierStyle(wt) : tierStyle(MAX_TIER);
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums ${st.bg} ${st.text}`}
      title="Follow-up priority — T1×5 + T2×3 + T3×2 + T4+×1"
    >
      {score}
      <span className="text-[10px] font-normal opacity-70">pts</span>
    </span>
  );
}

type SkuRow = {
  result: AuditRunResult;
  vendorName: string;
  countryCount: number;
  gapTiers: Map<number, number>;
  score: number;
};

type CompanyGroup = {
  key: string;
  participantId: string;
  vendorName: string;
  skus: SkuRow[];
  gapTiers: Map<number, number>;
  score: number;
};

export function ProductsGrid({ results }: { results: AuditRunResult[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AuditRunResult | null>(null);

  const rows: SkuRow[] = useMemo(
    () =>
      results.map((r) => {
        const gapTiers = gapsByTier(r.tree);
        return {
          result: r,
          // v1.30: audit-specific fields (origin, product_id) moved into the
          // discriminated payload union. Read them through the audit branch.
          vendorName:
            r.tree.vendor_legal_name ??
            (r.tree.payload.kind === 'audit'
              ? r.tree.payload.origin.vendor_name
              : null) ??
            '',
          countryCount: r.geo_rollup.length,
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
        e.result.product_id.toLowerCase().includes(q) ||
        e.vendorName.toLowerCase().includes(q),
    );
  }, [rows, query]);

  // Group SKUs under their tier-1 (direct) vendor, then order the queue:
  // companies by cumulative follow-up score desc, SKUs within a company by
  // their own score desc. Biggest offender — and its worst SKU — float up.
  const groups: CompanyGroup[] = useMemo(() => {
    const byCompany = new Map<string, CompanyGroup>();
    for (const r of filtered) {
      const key = r.result.vendor_participant_id || `name:${r.vendorName}`;
      let g = byCompany.get(key);
      if (!g) {
        g = {
          key,
          participantId: r.result.vendor_participant_id,
          vendorName: r.vendorName,
          skus: [],
          gapTiers: new Map(),
          score: 0,
        };
        byCompany.set(key, g);
      }
      g.skus.push(r);
      mergeTiers(g.gapTiers, r.gapTiers);
      g.score += r.score;
      if (!g.vendorName && r.vendorName) g.vendorName = r.vendorName;
    }
    const list = Array.from(byCompany.values());
    for (const g of list) {
      g.skus.sort((a, b) => b.score - a.score || a.result.product_id.localeCompare(b.result.product_id));
    }
    list.sort(
      (a, b) => b.score - a.score || a.vendorName.localeCompare(b.vendorName),
    );
    return list;
  }, [filtered]);

  const singleCompany = groups.length === 1;

  const skuColumns: Column<SkuRow>[] = [
    {
      key: 'product',
      label: 'Product',
      nowrap: true,
      render: (r) => (
        <span className="font-mono text-charcoal">{r.result.product_id}</span>
      ),
    },
    {
      key: 'countries',
      label: 'Countries',
      align: 'right',
      nowrap: true,
      render: (r) => r.countryCount,
    },
    {
      key: 'gaps',
      label: 'Gaps by tier',
      align: 'right',
      nowrap: true,
      render: (r) => <GapTierBar tiers={r.gapTiers} />,
    },
    {
      key: 'score',
      label: 'Priority',
      align: 'right',
      nowrap: true,
      render: (r) => <ScorePill score={r.score} tiers={r.gapTiers} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      nowrap: true,
      render: (r) => {
        const blocked = rootBlockingGap(r.result.tree);
        if (blocked) {
          return (
            <span
              className="rounded bg-[var(--color-problem)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--color-problem)]"
              title={`Root audit blocked: ${blocked.replace(/_/g, ' ')}`}
            >
              {GAP_KIND_LABEL[blocked]}
            </span>
          );
        }
        return (
          <button
            onClick={() => setSelected(r.result)}
            className="text-xs text-teal hover:text-navy"
          >
            View tree
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by product or vendor"
          className="flex-1 min-w-[220px] px-3 py-1.5 text-sm border border-slate/20 rounded focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <span className="text-xs text-slate">
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
              open={singleCompany}
              className="group rounded border border-slate/15 bg-white"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-light-gray/50">
                <span className="text-slate transition-transform group-open:rotate-90">
                  ▸
                </span>
                {!singleCompany && (
                  <span className="text-xs font-semibold tabular-nums text-slate">
                    #{idx + 1}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  {g.vendorName ? (
                    <span className="font-medium text-charcoal">
                      {g.vendorName}
                    </span>
                  ) : (
                    <IdChip id={g.participantId} />
                  )}
                  <span className="ml-2 text-xs text-slate">
                    {g.skus.length} {g.skus.length === 1 ? 'SKU' : 'SKUs'}
                  </span>
                </span>
                <GapTierBar tiers={g.gapTiers} />
                <ScorePill score={g.score} tiers={g.gapTiers} />
              </summary>
              <div className="border-t border-slate/10 p-3">
                <DataTable
                  columns={skuColumns}
                  data={g.skus}
                  keyFn={(r) => r.result.result_id}
                  emptyMessage="No SKUs."
                />
              </div>
            </details>
          ))}
        </div>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={
          selected
            ? `Observation tree · ${
                rows.find((e) => e.result.result_id === selected.result_id)
                  ?.vendorName || selected.product_id
              }`
            : 'Observation tree'
        }
        width="max-w-2xl"
      >
        {selected && <TreeView node={selected.tree} />}
      </Drawer>
    </div>
  );
}
