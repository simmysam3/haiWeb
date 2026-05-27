'use client';

import { useMemo, useState } from 'react';
import type { AuditRunResult, ObservationNode, AuditGapKind } from '@haiwave/protocol';
import { DataTable, type Column, Drawer } from '@/components';
import { IdChip } from '@/components/id-chip';
import { TreeView } from './tree-view';
import {
  GapTierBar,
  ScorePill,
  tierBucket,
  scoreOf,
  mergeTiers,
} from '@/components/sonar/observations';

const GAP_KIND_LABEL: Record<AuditGapKind, string> = {
  non_participant: 'Non-participant',
  agent_offline: 'Agent offline',
  unauthorized: 'Unauthorized',
  depth_limited: 'Depth limit',
};

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

// "Nothing to view" when the root node has a gap and no components — the
// audit was blocked or pruned at the very top, so opening the drawer would
// just show an empty tree. Surface the gap reason in place of the action.
function rootBlockingGap(node: ObservationNode): AuditGapKind | null {
  if (node.gap && node.components.length === 0) return node.gap.kind;
  return null;
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
  // null = sub-tier identity withheld by the disclosure boundary (protocol
  // 3.26.0). Such rows still group together under `name:${vendorName}` keys.
  participantId: string | null;
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
        (e.result.product_id?.toLowerCase().includes(q) ?? false) ||
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
      g.skus.sort((a, b) => b.score - a.score || (a.result.product_id ?? '').localeCompare(b.result.product_id ?? ''));
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
                  ) : g.participantId ? (
                    <IdChip id={g.participantId} />
                  ) : (
                    <span
                      className="text-xs italic text-slate/70"
                      title="Sub-tier vendor identity withheld by the disclosure boundary; only region-level provenance is visible for SKUs in this group."
                    >
                      Identity withheld
                    </span>
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
