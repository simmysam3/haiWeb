'use client';
import { useState } from 'react';
import type { SmProductResult, SourcingMapExecutionResult } from '@/lib/sourcing-map/contract';
import type { SmPortfolioDrop } from '@/lib/sourcing-map/types';
import { formatDropDate, formatPct, formatQty, groupDrops, heatVar } from '@/lib/sourcing-map/map/selectors';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

export interface SeatBarProps {
  result: SourcingMapExecutionResult;
  unitLabel: string;
  asOfDrop: string | null;
  onDrop(drop: string): void;
  productFilter: string | null;
  onProduct(id: string | null): void;
}

/** "All products" plus one chip per product with its coverage (spec §9.3). */
export function ProductStrip({ products, selected, onSelect }: { products: SmProductResult[]; selected: string | null; onSelect(id: string | null): void }) {
  return (
    <div role="group" aria-label="Filter by product" className="mt-3 flex flex-wrap gap-2">
      <button type="button" aria-pressed={selected === null} onClick={() => onSelect(null)} className="sm-btn sm-btn-ghost text-xs">All products</button>
      {products.map((p) => {
        const last = p.drops[p.drops.length - 1];
        const label = p.status === 'failed' ? `${p.name} · BOM unavailable from agent` : `${p.name}${last ? ` ${formatPct(last.coverage)}` : ''}`;
        return (
          <button key={p.product_id} type="button" aria-pressed={selected === p.product_id} onClick={() => onSelect(p.product_id)} className="sm-btn sm-btn-ghost text-xs">
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** One segment per drop with its coverage; grouped by month beyond 12 drops (spec §9.3). Colour is never the only carrier. */
export function DropStrip({ drops, asOfDrop, onDrop }: { drops: SmPortfolioDrop[]; asOfDrop: string | null; onDrop(drop: string): void }) {
  const groups = groupDrops(drops);
  const byMonth = drops.length > 12;
  const [open, setOpen] = useState<string | null>(null);
  const openGroup = groups.find((g) => g.key === open);
  return (
    <div className="mt-3">
      <div role="group" aria-label="Drops: choose the drop the map shows" className="flex flex-wrap gap-1">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-pressed={g.drops.some((d) => d.due_date === asOfDrop)}
            aria-expanded={byMonth ? open === g.key : undefined}
            onClick={() => (byMonth ? setOpen(open === g.key ? null : g.key) : onDrop(g.drops[0]!.due_date))}
            className="group sm-btn sm-btn-ghost text-xs"
            style={{ borderBottom: `3px solid ${heatVar(g.coverage)}` }}
          >
            {/* A month expands inline, so it carries the house drill-down chevron (haiWeb CLAUDE.md); it is aria-hidden and adds no text. */}
            {byMonth && <DetailChevron expanded={open === g.key} />}
            {byMonth ? `${g.label} · ${g.drops.length} drops · lowest ${formatPct(g.coverage)}` : `${g.label} ${formatPct(g.coverage)}`}
          </button>
        ))}
      </div>
      {byMonth && openGroup && (
        <div role="group" aria-label={`Drops in ${openGroup.label}`} className="mt-2 flex flex-wrap gap-1">
          {openGroup.drops.map((d) => (
            <button
              key={d.due_date}
              type="button"
              aria-pressed={d.due_date === asOfDrop}
              onClick={() => onDrop(d.due_date)}
              className="sm-btn sm-btn-ghost text-xs"
              style={{ borderBottom: `3px solid ${heatVar(d.coverage)}` }}
            >
              {`${formatDropDate(d.due_date)} ${formatPct(d.coverage)}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The seat bar (spec §9.3). Cycles 37.2 and 37.3 add the product and drop strips, which take the other props. */
export function SeatBar({ result, unitLabel, asOfDrop, onDrop, productFilter, onProduct }: SeatBarProps) {
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
      <ProductStrip products={result.products} selected={productFilter} onSelect={onProduct} />
      <DropStrip drops={drops} asOfDrop={asOfDrop} onDrop={onDrop} />
    </div>
  );
}
