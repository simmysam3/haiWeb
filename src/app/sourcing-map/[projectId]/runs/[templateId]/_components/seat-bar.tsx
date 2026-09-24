'use client';
import type { SourcingMapExecutionResult } from '@/lib/sourcing-map/contract';
import { formatDropDate, formatPct, formatQty } from '@/lib/sourcing-map/map/selectors';

export interface SeatBarProps {
  result: SourcingMapExecutionResult;
  unitLabel: string;
  asOfDrop: string | null;
  onDrop(drop: string): void;
  productFilter: string | null;
  onProduct(id: string | null): void;
}

/** The seat bar (spec §9.3). Cycles 37.2 and 37.3 add the product and drop strips, which take the other props. */
export function SeatBar({ result, unitLabel }: SeatBarProps) {
  const drops = result.portfolio.drops;
  const last = drops[drops.length - 1];
  return (
    <div className="sm-surface border-b border-[var(--sm-line)] px-6 py-4">
      <dl className="flex flex-wrap gap-8 text-sm">
        <div>
          <dt className="sm-muted text-xs">Portfolio demand</dt>
          <dd className="sm-heading text-lg font-semibold">{last ? `${formatQty(last.demand)} ${unitLabel} · ${drops.length} drop${drops.length === 1 ? '' : 's'}` : 'No composed demand'}</dd>
        </div>
        <div>
          <dt className="sm-muted text-xs">Covered by the last drop</dt>
          <dd className="sm-heading text-lg font-semibold">{last ? formatPct(last.coverage) : '—'}</dd>
        </div>
        <div>
          <dt className="sm-muted text-xs">First short drop</dt>
          <dd className="sm-heading text-lg font-semibold">{result.portfolio.first_short_drop ? formatDropDate(result.portfolio.first_short_drop) : 'None'}</dd>
        </div>
      </dl>
    </div>
  );
}
