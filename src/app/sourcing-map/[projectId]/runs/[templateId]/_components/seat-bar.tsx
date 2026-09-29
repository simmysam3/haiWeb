'use client';
import { useId, useState } from 'react';
import type { SmProductResult, SourcingMapExecutionResult } from '@haiwave/protocol';
import type { SmPortfolioDrop } from '@/lib/sourcing-map/types';
import { MAX_DROP_SEGMENTS, formatDropDate, formatPct, formatQty, groupDrops, heatVar } from '@/lib/sourcing-map/map/selectors';
import { DetailChevron } from '@/components/sonar/observations/detail-chevron';

export interface SeatBarProps {
  result: SourcingMapExecutionResult;
  unitLabel: string;
  asOfDrop: string | null;
  onDrop(drop: string): void;
  productFilter: string | null;
  onProduct(id: string | null): void;
}

/** The product filter (spec §9.3): its label, "All products", then one chip per product with its coverage. */
export function ProductStrip({ products, selected, onSelect }: { products: SmProductResult[]; selected: string | null; onSelect(id: string | null): void }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="mt-3 flex flex-wrap items-center gap-2">
      <span id={labelId} className="sm-muted text-xs">Filter by product</span>
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

/** The first short drop's mark on the timeline: words, in the warning colour (colour is never the only carrier). */
function FirstShort({ drop }: { drop?: string }) {
  return (
    <>
      {' · '}
      <span className="sm-warn font-semibold">{drop ? `first short ${formatDropDate(drop)}` : 'first short'}</span>
    </>
  );
}

/**
 * One segment per drop with its coverage; grouped by month beyond MAX_DROP_SEGMENTS drops (spec §9.3). The first
 * short drop is marked where it falls (owner's walk, 2026-09-29). Colour is never the only carrier.
 */
export function DropStrip({ drops, asOfDrop, onDrop, firstShort }: { drops: SmPortfolioDrop[]; asOfDrop: string | null; onDrop(drop: string): void; firstShort: string | null }) {
  const groups = groupDrops(drops);
  const byMonth = drops.length > MAX_DROP_SEGMENTS;
  const [open, setOpen] = useState<string | null>(null);
  const openGroup = groups.find((g) => g.key === open);
  return (
    <div className="min-w-0 flex-1">
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
            {byMonth ? `${g.label} · ${g.drops.length} drop${g.drops.length === 1 ? '' : 's'} · lowest ${formatPct(g.coverage)}` : `${g.label} ${formatPct(g.coverage)}`}
            {firstShort !== null && g.drops.some((d) => d.due_date === firstShort) && <FirstShort drop={byMonth ? firstShort : undefined} />}
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
              {d.due_date === firstShort && <FirstShort />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The seat bar (spec §9.3; owner's walk, 2026-09-29): the portfolio demand and its drops on one line, since the
 * drops are that demand's timeline, then the product filter underneath.
 */
export function SeatBar({ result, unitLabel, asOfDrop, onDrop, productFilter, onProduct }: SeatBarProps) {
  const drops = result.portfolio.drops;
  const last = drops[drops.length - 1];
  return (
    <div className="sm-surface border-b border-[var(--sm-line)] px-6 py-4">
      <div data-testid="sm-seat-timeline" className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <dl className="text-sm">
          <dt className="sm-muted text-xs">Portfolio demand</dt>
          <dd className="sm-heading text-lg font-semibold">{last ? `${formatQty(last.demand)} ${unitLabel} · ${drops.length} drop${drops.length === 1 ? '' : 's'}` : 'No composed demand'}</dd>
        </dl>
        <DropStrip drops={drops} asOfDrop={asOfDrop} onDrop={onDrop} firstShort={result.portfolio.first_short_drop} />
      </div>
      <ProductStrip products={result.products} selected={productFilter} onSelect={onProduct} />
    </div>
  );
}
