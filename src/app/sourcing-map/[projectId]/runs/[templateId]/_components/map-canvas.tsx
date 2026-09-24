'use client';
import { useLayoutEffect } from 'react';
import type { SourcingMapExecutionResult } from '@/lib/sourcing-map/contract';
import { layoutMap, MAP_L } from '@/lib/sourcing-map/map/layout';
import { candidateWeekAt, heatVar, slotCoverageAt, slotWeekFor } from '@/lib/sourcing-map/map/selectors';
import { OptionCard } from './option-card';
import { SlotRail } from './slot-rail';
import { SeatCard, type SeatInfo } from './seat-card';

const NEUTRAL_STROKE = 'var(--sm-line-2)';
/** R-9's render-start mark; the layout effect measures from it to commit, then clears it. */
const RENDER_START = 'sm-map-render:start';

export interface MapCanvasProps {
  result: SourcingMapExecutionResult;
  asOfDrop: string | null;
  productFilter: string | null;
  productNames: Record<string, string>;
  seat: SeatInfo;
  selected: { slot: number; candidate: number } | null;
  onSelect(sel: { slot: number; candidate: number }): void;
  collapsed: ReadonlySet<number>;
  onToggle(slotIndex: number): void;
}

/** The map (spec §9.3): the prototype's canvas as DOM cards over one SVG link overlay. */
export function MapCanvas({ result, asOfDrop, productFilter, productNames, seat, selected, onSelect, collapsed, onToggle }: MapCanvasProps) {
  // R-9: time render → commit; the SP1-e walk reads this in a real browser. Hooks come first, before any early return.
  // The start is a timeline mark, not a value read during render, so nothing time-dependent reaches the output (ruling F03).
  performance.mark(RENDER_START);
  useLayoutEffect(() => {
    performance.clearMeasures('sm-map-render');
    performance.measure('sm-map-render', RENDER_START);
    performance.clearMarks(RENDER_START);
  });
  const lay = layoutMap(result.slots, collapsed);
  const seatOutX = lay.seat.x + lay.seat.w;
  const seatOutY = lay.seat.y + 44;
  const paths: Array<{ d: string; stroke: string; key: string }> = [];
  for (const lane of lay.lanes) {
    const slot = result.slots[lane.slotIndex]!;
    const week = slotWeekFor(slot, asOfDrop);
    const cov = slotCoverageAt(slot, week);
    const busY = lane.y + 40;
    paths.push({
      key: `s${lane.slotIndex}`,
      stroke: cov ? heatVar(cov.coverage) : NEUTRAL_STROKE,
      d: `M${seatOutX} ${seatOutY} C ${seatOutX + 40} ${seatOutY}, ${lay.lanesX - 44} ${busY}, ${lay.lanesX - 8} ${busY}`,
    });
    for (const card of lane.cards) {
      const c = slot.candidates[card.candidateIndex]!;
      const w = candidateWeekAt(c, week);
      const cx = card.x + MAP_L.cardW / 2;
      paths.push({
        key: `s${lane.slotIndex}c${card.candidateIndex}`,
        stroke: w ? heatVar(w.option_coverage) : NEUTRAL_STROKE,
        d: `M${lay.lanesX - 8} ${busY} L ${cx} ${busY} L ${cx} ${card.y}`,
      });
    }
  }
  if (result.slots.length === 0) {
    const allFailed = result.products.length > 0 && result.products.every((p) => p.status === 'failed');
    return (
      <section aria-label="Sourcing map" className="p-6">
        <p className="sm-muted text-xs">Direct suppliers only; nothing below tier 1 has been traced.</p>
        <p role="status" className="sm-card mt-4 p-6 text-sm">
          {allFailed
            ? "Nothing to map: every product's BOM was unavailable from the agent."
            : 'Nothing to map: the products in this run have no BOM lines yet.'}
        </p>
      </section>
    );
  }
  return (
    <section aria-label="Sourcing map" className="relative overflow-auto">
      <p className="sm-muted px-6 pt-4 text-xs">Direct suppliers only; nothing below tier 1 has been traced.</p>
      <div className="relative" style={{ width: lay.width, height: lay.height }}>
        <svg data-map-links aria-hidden="true" width={lay.width} height={lay.height} className="pointer-events-none absolute inset-0">
          {paths.map((p) => <path key={p.key} d={p.d} fill="none" strokeWidth={2} style={{ stroke: p.stroke }} />)}
        </svg>
        <div className="absolute" style={{ left: lay.seat.x, top: lay.seat.y, width: lay.seat.w, height: lay.seat.h }}>
          <SeatCard seat={seat} />
        </div>
        {lay.lanes.map((lane) => {
          const slot = result.slots[lane.slotIndex]!;
          const dimmed = productFilter !== null && !slot.product_ids.includes(productFilter);
          return (
            <div key={lane.slotIndex} role="group" aria-label={slot.class_label} className={dimmed ? 'opacity-40' : undefined}>
              <div className="absolute" style={{ left: lay.lanesX, top: lane.y, width: lay.width - lay.lanesX - 40 }}>
                <SlotRail slot={slot} asOfDrop={asOfDrop} collapsed={lane.collapsed} onToggle={() => onToggle(lane.slotIndex)} productNames={productNames} productFilter={productFilter} />
              </div>
              {lane.cards.map((card) => (
                <div key={card.candidateIndex} className="absolute" style={{ left: card.x, top: card.y, width: MAP_L.cardW, height: MAP_L.cardH }}>
                  <OptionCard
                    slot={slot}
                    candidate={slot.candidates[card.candidateIndex]!}
                    asOfDrop={asOfDrop}
                    drops={result.portfolio.drops}
                    selected={selected?.slot === lane.slotIndex && selected.candidate === card.candidateIndex}
                    onSelect={() => onSelect({ slot: lane.slotIndex, candidate: card.candidateIndex })}
                  />
                </div>
              ))}
              {!lane.collapsed && slot.not_probed_count > 0 && (
                <p className="sm-muted absolute text-xs" style={{ left: lay.lanesX + lane.cards.length * (MAP_L.cardW + MAP_L.gap), top: lane.y + MAP_L.laneHeadH + 8 }}>
                  {`+${slot.not_probed_count} not probed`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
