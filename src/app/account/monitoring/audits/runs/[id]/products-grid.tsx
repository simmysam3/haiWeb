'use client';

import { useMemo, useState } from 'react';
import type { AuditRunResult, AuditTraversalNode } from '@haiwave/protocol';
import { DataTable, type Column, Drawer } from '@/components';
import { IdChip } from '@/components/id-chip';
import { TreeView } from './tree-view';

const PAGE_SIZE = 100;

function countGaps(node: AuditTraversalNode): number {
  let n = node.gap ? 1 : 0;
  for (const c of node.components) n += countGaps(c);
  return n;
}

export function ProductsGrid({ results }: { results: AuditRunResult[] }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditRunResult | null>(null);

  const enriched = useMemo(
    () =>
      results.map((r) => ({
        result: r,
        vendorName: r.tree.vendor_legal_name ?? r.tree.origin.vendor_name ?? '',
        countryCount: r.geo_rollup.length,
        gapCount: countGaps(r.tree),
      })),
    [results],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter(
      (e) =>
        e.result.product_id.toLowerCase().includes(q) ||
        e.vendorName.toLowerCase().includes(q),
    );
  }, [enriched, query]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  type Row = (typeof enriched)[number];

  const columns: Column<Row>[] = [
    {
      key: 'product',
      label: 'Product',
      nowrap: true,
      render: (r) => (
        <span className="font-mono text-charcoal">{r.result.product_id}</span>
      ),
    },
    {
      key: 'vendor',
      label: 'Vendor',
      render: (r) =>
        r.vendorName ? (
          <span title={r.result.vendor_participant_id}>{r.vendorName}</span>
        ) : (
          <IdChip id={r.result.vendor_participant_id} />
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
      label: 'Gaps',
      align: 'right',
      nowrap: true,
      render: (r) =>
        r.gapCount > 0 ? (
          <span className="text-[var(--color-problem)]">{r.gapCount}</span>
        ) : (
          0
        ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      nowrap: true,
      render: (r) => (
        <button
          onClick={() => setSelected(r.result)}
          className="text-xs text-teal hover:text-navy"
        >
          View tree
        </button>
      ),
    },
  ];

  const rangeLabel = total === 0
    ? '0 of 0'
    : `${start + 1}–${Math.min(start + PAGE_SIZE, total)} of ${total}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by product or vendor"
          className="flex-1 min-w-[220px] px-3 py-1.5 text-sm border border-slate/20 rounded focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
        />
        <span className="text-xs text-slate">{rangeLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-2 py-1 text-xs border border-slate/20 rounded text-slate hover:text-charcoal disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-xs text-slate px-1">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-2 py-1 text-xs border border-slate/20 rounded text-slate hover:text-charcoal disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={pageRows}
        keyFn={(r) => r.result.result_id}
        emptyMessage={
          query ? 'No products match your search.' : 'No results recorded for this run.'
        }
      />

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? `Tree · ${selected.product_id}` : 'Tree'}
        width="max-w-2xl"
      >
        {selected && <TreeView node={selected.tree} />}
      </Drawer>
    </div>
  );
}
