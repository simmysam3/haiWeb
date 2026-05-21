import { Panel } from '@/components';

/**
 * v1.34 P6 — four-tile coverage stats (§10.2). Server-supplied percentages
 * (P6-D2). Pure server component (no client interactivity).
 *
 * Inline type mirror of @haiwave/protocol CoverageCurrent — keep in sync
 * with packages/protocol/src/audit/compliance-coverage.ts.
 */
export interface CoverageSnapshot {
  snapshot_id: string;
  snapshot_completed_at: string;
  coverage_total_products: number;
  coverage_complete_products: number;
  coverage_partial_products: number;
  coverage_no_traversal_products: number;
  complete_pct: number;
  partial_pct: number;
  no_traversal_pct: number;
}

function Tile({ label, count, pct }: { label: string; count: number; pct?: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-slate">{label}</span>
      <span className="text-2xl font-semibold text-charcoal">{count}</span>
      {pct !== undefined && <span className="text-sm text-slate">{pct}%</span>}
    </div>
  );
}

export function CoverageStatsStrip({ snapshot }: { snapshot: CoverageSnapshot }) {
  return (
    <Panel className="p-4">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-navy mb-3">
        Coverage
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Tile label="Total products" count={snapshot.coverage_total_products} />
        <Tile label="Complete" count={snapshot.coverage_complete_products} pct={snapshot.complete_pct} />
        <Tile label="Partial" count={snapshot.coverage_partial_products} pct={snapshot.partial_pct} />
        <Tile label="No traversal" count={snapshot.coverage_no_traversal_products} pct={snapshot.no_traversal_pct} />
      </div>
      <p className="text-xs text-slate italic mt-3">
        As of {new Date(snapshot.snapshot_completed_at).toLocaleString()}
      </p>
    </Panel>
  );
}
