import type { SmSlotResult } from '@haiwave/protocol';

/** The prototype's canvas geometry (docs/haiwave-sourcing-map.html:1325 `L`, :1329-1340). */
export const MAP_L = {
  seatX: 24, seatW: 236, seatH: 168, top: 24,
  lanesGapX: 76, laneGap: 28,
  cardW: 236, cardH: 212, gap: 16, minLaneW: 480,
} as const;

/**
 * The slot rail's line metrics. The prototype's header was one line in a 50 px band with the link bus beneath it;
 * this rail has four to six lines, so a lane's header is sized from its lines and the links run in a gutter below them.
 */
export const RAIL_L = { line: 20, lineGap: 4, small: 16, cellW: 60, cellH: 18, cellGap: 4, linkGutter: 24 } as const;

export interface MapLayout {
  seat: { x: number; y: number; w: number; h: number };
  lanesX: number;
  /** the width of every lane and of its rail */
  laneW: number;
  lanes: Array<{
    slotIndex: number; y: number; h: number; collapsed: boolean;
    /** the height of the rail's text; the links and the cards stay below it */
    textH: number;
    cards: Array<{ candidateIndex: number; x: number; y: number }>;
  }>;
  width: number;
  height: number;
}

/** The sizes a size-bound slot's strip can show: the most any of its weeks reports. */
function stripSizeCount(slot: SmSlotResult): number {
  if (!slot.slot_key.variant_bound) return 0;
  return Math.max(0, ...slot.coverage.map((c) => (c.coverage_by_variant ? Object.keys(c.coverage_by_variant).length : 0)));
}

/**
 * The height of a slot's rail text. It depends on the slot and the lane width, never on the drop shown,
 * so the coverage line is always reserved and the lanes stay put while the drop changes.
 */
export function railTextHeight(slot: SmSlotResult, laneW: number): number {
  const lines = RAIL_L.line + RAIL_L.lineGap + RAIL_L.line + RAIL_L.line + RAIL_L.line;
  if (!slot.slot_key.variant_bound) return lines;
  const sizes = stripSizeCount(slot);
  if (sizes === 0) return lines + RAIL_L.small;
  const perRow = Math.max(1, Math.floor((laneW + RAIL_L.cellGap) / (RAIL_L.cellW + RAIL_L.cellGap)));
  const rows = Math.ceil(sizes / perRow);
  return lines + RAIL_L.small + RAIL_L.lineGap + rows * RAIL_L.cellH + (rows - 1) * RAIL_L.cellGap;
}

/** Lane and card positions. Cards are the probed candidates; cap_reached rows are "+N not probed". */
export function layoutMap(slots: SmSlotResult[], collapsed: ReadonlySet<number>): MapLayout {
  const lanesX = MAP_L.seatX + MAP_L.seatW + MAP_L.lanesGapX;
  const shownOf = (slot: SmSlotResult) => slot.candidates.map((c, i) => ({ c, i })).filter(({ c }) => c.status !== 'cap_reached');
  const maxCards = Math.max(0, ...slots.map((slot) => shownOf(slot).length));
  const laneW = Math.max(MAP_L.minLaneW, maxCards * (MAP_L.cardW + MAP_L.gap) - MAP_L.gap);
  let y = MAP_L.top;
  const lanes = slots.map((slot, slotIndex) => {
    const isCollapsed = collapsed.has(slotIndex);
    const shown = shownOf(slot);
    const textH = railTextHeight(slot, laneW);
    const headH = textH + RAIL_L.linkGutter;
    const h = isCollapsed || shown.length === 0 ? headH : headH + MAP_L.cardH;
    const cards = isCollapsed ? [] : shown.map(({ i }, k) => ({ candidateIndex: i, x: lanesX + k * (MAP_L.cardW + MAP_L.gap), y: y + headH }));
    const lane = { slotIndex, y, h, collapsed: isCollapsed, textH, cards };
    y += h + MAP_L.laneGap;
    return lane;
  });
  return {
    seat: { x: MAP_L.seatX, y: MAP_L.top, w: MAP_L.seatW, h: MAP_L.seatH },
    lanesX,
    laneW,
    lanes,
    width: lanesX + laneW + 40,
    height: Math.max(y, MAP_L.top + MAP_L.seatH + 40),
  };
}
