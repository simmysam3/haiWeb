'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import type { SourcingMapExecutionResult2 as SourcingMapExecutionResult } from '@/lib/sourcing-map/types';
import { layoutMap, MAP_L, RAIL_L } from '@/lib/sourcing-map/map/layout';
import { candidateKeyOf, candidateNamesOf, candidateWeekAt, heatVar, laneState, slotTitle, slotWeekFor, type LaneState } from '@/lib/sourcing-map/map/selectors';
import { OptionCard } from './option-card';
import { SlotRail } from './slot-rail';
import { SeatCard, type SeatInfo } from './seat-card';
import { TraceOverlay, type AnchorRect } from './trace-overlay';
import { MapToolbar } from './map-toolbar';
import { SupplyChainLimits } from './supply-chain-limits';
import { SharedExposure } from './shared-exposure';

const SP1_CAPTION = 'Direct suppliers only; nothing below tier 1 has been traced.';
/** Contract §10: an SP2 result (a projection was served) says what the tiers below show and what they never do. */
const SP2_CAPTION = 'Identity, quantities and names below tier 1 are not disclosed.';

const NEUTRAL_STROKE = 'var(--sm-line-2)';
/** A lane's main line by its state (laneState): cyan, orange, red. */
const MAIN_STROKE: Record<LaneState, string> = {
  met: 'var(--sm-heat-good)',
  reallocate: 'var(--sm-heat-mid)',
  short: 'var(--sm-heat-bad)',
};
/** R-9's render-start mark: each render replaces it, and the layout effect measures from it to commit. */
const RENDER_START = 'sm-map-render:start';

/**
 * Every [data-anchor] inside the frame, in the frame's coordinates, for one traced card: its own key, and its
 * `key/alias` handles by alias.
 */
function measureAnchors(frame: HTMLElement, tracedKey: string): Record<string, AnchorRect> {
  const base = frame.getBoundingClientRect();
  const out: Record<string, AnchorRect> = {};
  for (const el of Array.from(frame.querySelectorAll<HTMLElement>('[data-anchor]'))) {
    const anchor = el.dataset.anchor ?? '';
    const r = el.getBoundingClientRect();
    const rect = { x: r.left - base.left, y: r.top - base.top, width: r.width, height: r.height };
    if (anchor === tracedKey) out[anchor] = rect;
    else if (anchor.startsWith(`${tracedKey}/`)) out[anchor.slice(tracedKey.length + 1)] = rect;
  }
  return out;
}

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
  /**
   * SP2 (spec §12.1, §12.4): the pressed handle and the card it was pressed on; the workspace owns it, the canvas owns
   * hover and the anchors. A shared alias reads pressed only under its origin card (ruling R6).
   */
  selectedHandle?: { alias: string; origin: string } | null;
  onSelectAlias?(alias: string | null, origin: string): void;
  /** LF (spec §6.4): Hide all paths, offered while a path is open, which is the canvas's own to say (a card is selected) */
  onHideAll?(): void;
  /** LF (spec §9.5): why the map's tools are unavailable (a running execution), or null when they work */
  unavailable?: string | null;
  /** LF (spec §6.6): the links' heat, on by default; the workspace owns it and its storage */
  heat?: boolean;
  onHeat?(next: boolean): void;
}

/** The map (spec §9.3): the prototype's canvas as DOM cards over one SVG link overlay. */
export function MapCanvas({
  result, asOfDrop, productFilter, productNames, seat, selected, onSelect, collapsed, onToggle,
  selectedHandle = null, onSelectAlias = () => undefined, onHideAll = () => undefined, unavailable = null,
  heat = true, onHeat = () => undefined,
}: MapCanvasProps) {
  // R-9: time render → commit; the SP1-e walk reads this in a real browser. Hooks come first, before any early return.
  // The start is a timeline mark, not a value read during render, so nothing time-dependent reaches the output (ruling F03).
  // The render clears the previous mark and the effect never does (F03 amended): StrictMode re-runs the layout effect
  // without a re-render, sibling canvases share the name, and a server render never runs the effect at all.
  performance.clearMarks(RENDER_START);
  performance.mark(RENDER_START);
  useLayoutEffect(() => {
    performance.clearMeasures('sm-map-render');
    performance.measure('sm-map-render', RENDER_START);
  });
  // SP2: hover and anchors are the canvas's own; the selected handle is the workspace's (it drives the side column).
  const [hoveredAlias, setHoveredAlias] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<Record<string, AnchorRect>>({});
  const frameRef = useRef<HTMLDivElement | null>(null);
  const tracedCandidate = selected !== null && !collapsed.has(selected.slot) ? result.slots[selected.slot]?.candidates[selected.candidate] ?? null : null;
  const trace = tracedCandidate?.trace ?? null;
  const tracedKey = tracedCandidate ? candidateKeyOf(tracedCandidate) : null;
  // Measured after commit, in the frame's coordinates (the svg's). A trace whose handles are not in the DOM yet
  // gets no anchor for them and the overlay skips those edges (Review Focus 2). Deps, not every render: setting
  // state here re-renders once, and the effect does not run again for that render. With no trace the overlay is
  // unmounted, so anchors left from an earlier trace are never drawn (ruling R4: no reset, only the ref-derived set).
  // The measurement is a function of the frame because react-hooks/set-state-in-effect allows a setState only when its
  // argument is computed from a ref; an object filled in by mutation never counts as ref-derived, so keep it a call.
  // #38: a pressed handle's 2 px border and bold weight (sourcing-map.css) move the handles after it in its row, so
  // the pressed handle is a dep too.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (trace === null || tracedKey === null || frame === null) return;
    setAnchors(measureAnchors(frame, tracedKey));
  }, [trace, tracedKey, result, collapsed, asOfDrop, selectedHandle]);
  const caption = result.projection_k !== undefined && result.projection_k !== null ? SP2_CAPTION : SP1_CAPTION;
  const names = candidateNamesOf(result);
  const lay = layoutMap(result.slots, collapsed);
  const seatOutX = lay.seat.x + lay.seat.w;
  const seatOutY = lay.seat.y + 44;
  const paths: Array<{ d: string; stroke: string; key: string; kind: 'trunk' | 'bus' | 'drop'; slot: number }> = [];
  for (const lane of lay.lanes) {
    const slot = result.slots[lane.slotIndex]!;
    const week = slotWeekFor(slot, asOfDrop);
    // Owner's walk rulings (2026-09-29): a lane's main line, the seat link and the bus, is one colour, the lane's
    // state at this drop (laneState). Only a card's drop shows that card's own 90 / 70 heat. With the heat switched
    // off (LF §6.6) every link is neutral; the pips and the trace line keep their colours.
    const state = laneState(slot, week);
    const main = !heat || state === null ? NEUTRAL_STROKE : MAIN_STROKE[state];
    // The bus runs in the gutter between the rail's text and the cards, so no link crosses a header line.
    const busY = lane.y + lane.textH + RAIL_L.linkGutter / 2;
    paths.push({
      key: `s${lane.slotIndex}`, kind: 'trunk', slot: lane.slotIndex, stroke: main,
      d: `M${seatOutX} ${seatOutY} C ${seatOutX + 40} ${seatOutY}, ${lay.lanesX - 44} ${busY}, ${lay.lanesX - 8} ${busY}`,
    });
    const last = lane.cards[lane.cards.length - 1];
    if (last) {
      paths.push({
        key: `s${lane.slotIndex}bus`, kind: 'bus', slot: lane.slotIndex, stroke: main,
        d: `M${lay.lanesX - 8} ${busY} L ${last.x + MAP_L.cardW / 2} ${busY}`,
      });
    }
    for (const card of lane.cards) {
      const c = slot.candidates[card.candidateIndex]!;
      const w = candidateWeekAt(c, week);
      const cx = card.x + MAP_L.cardW / 2;
      paths.push({
        key: `s${lane.slotIndex}c${card.candidateIndex}`, kind: 'drop', slot: lane.slotIndex,
        stroke: heat && w ? heatVar(w.option_coverage) : NEUTRAL_STROKE,
        d: `M${cx} ${busY} L ${cx} ${card.y}`,
      });
    }
  }
  if (result.slots.length === 0) {
    // Review Focus 5: the reason as it is, whether every BOM failed, some did, or none did (M2 amended).
    const anyFailed = result.products.some((p) => p.status === 'failed');
    const allFailed = anyFailed && result.products.every((p) => p.status === 'failed');
    const reason = allFailed
      ? "Nothing to map: every product's BOM was unavailable from the agent."
      : anyFailed
        ? "Nothing to map: some products' BOMs were unavailable from the agent, and the others have no BOM lines yet."
        : 'Nothing to map: the products in this run have no BOM lines yet.';
    return (
      <section aria-label="Sourcing map" className="p-6">
        <p className="sm-muted text-xs">{caption}</p>
        <p role="status" className="sm-card mt-4 p-6 text-sm">{reason}</p>
      </section>
    );
  }
  return (
    <section aria-label="Sourcing map" className="relative overflow-auto">
      <p className="sm-muted px-6 pt-4 text-xs">{caption}</p>
      <MapToolbar pathsOpen={selected !== null} onHideAll={onHideAll} unavailable={unavailable} heat={heat} onHeat={onHeat} />
      <SupplyChainLimits result={result} onSelect={onSelect} />
      <SharedExposure result={result} />
      <div ref={frameRef} className="relative" style={{ width: lay.width, height: lay.height }}>
        <svg data-map-links aria-hidden="true" width={lay.width} height={lay.height} className="pointer-events-none absolute inset-0">
          {paths.map((p) => <path key={p.key} data-link={p.kind} data-slot={p.slot} d={p.d} fill="none" strokeWidth={2} style={{ stroke: p.stroke }} />)}
        </svg>
        <div className="absolute" style={{ left: lay.seat.x, top: lay.seat.y, width: lay.seat.w, height: lay.seat.h }}>
          <SeatCard seat={seat} />
        </div>
        {lay.lanes.map((lane) => {
          const slot = result.slots[lane.slotIndex]!;
          const dimmed = productFilter !== null && !slot.product_ids.includes(productFilter);
          return (
            <div key={lane.slotIndex} role="group" aria-label={slotTitle(slot)} className={dimmed ? 'opacity-40' : undefined}>
              <div className="absolute" style={{ left: lay.lanesX, top: lane.y, width: lay.width - lay.lanesX - 40 }}>
                <SlotRail slot={slot} asOfDrop={asOfDrop} collapsed={lane.collapsed} onToggle={() => onToggle(lane.slotIndex)} productNames={productNames} productFilter={productFilter} textH={lane.textH} />
              </div>
              {lane.cards.map((card) => {
                const c = slot.candidates[card.candidateIndex]!;
                const isSelected = selected?.slot === lane.slotIndex && selected.candidate === card.candidateIndex;
                return (
                  <div key={card.candidateIndex} className="absolute" style={{ left: card.x, top: card.y, width: MAP_L.cardW, height: lane.cardH }}>
                    <OptionCard
                      slot={slot}
                      candidate={c}
                      asOfDrop={asOfDrop}
                      drops={result.portfolio.drops}
                      selected={isSelected}
                      onSelect={() => onSelect({ slot: lane.slotIndex, candidate: card.candidateIndex })}
                      traced={isSelected}
                      selectedAlias={selectedHandle !== null && selectedHandle.origin === candidateKeyOf(c) ? selectedHandle.alias : null}
                      onSelectAlias={onSelectAlias}
                      hoveredAlias={hoveredAlias}
                      onHoverAlias={setHoveredAlias}
                    />
                  </div>
                );
              })}
              {!lane.collapsed && slot.not_probed_count > 0 && (
                <p className="sm-muted absolute text-xs" style={{ left: lay.lanesX + lane.cards.length * (MAP_L.cardW + MAP_L.gap), top: lane.y + lane.textH + RAIL_L.linkGutter + 8 }}>
                  {`+${slot.not_probed_count} not probed`}
                </p>
              )}
            </div>
          );
        })}
        {trace !== null && <TraceOverlay trace={trace} anchors={anchors} names={names} width={lay.width} height={lay.height} />}
      </div>
    </section>
  );
}
