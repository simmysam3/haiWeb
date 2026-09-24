import type { SmSlotResult } from '../contract';

/** The prototype's canvas geometry (docs/haiwave-sourcing-map.html:1325 `L`, :1329-1340). */
export const MAP_L = {
  seatX: 24, seatW: 236, seatH: 168, top: 24,
  lanesGapX: 76, laneHeadH: 96, laneGap: 28,
  cardW: 236, cardH: 212, gap: 16, minLaneW: 480,
} as const;

export interface MapLayout {
  seat: { x: number; y: number; w: number; h: number };
  lanesX: number;
  lanes: Array<{ slotIndex: number; y: number; h: number; collapsed: boolean; cards: Array<{ candidateIndex: number; x: number; y: number }> }>;
  width: number;
  height: number;
}

/** Lane and card positions. Cards are the probed candidates; cap_reached rows are "+N not probed". */
export function layoutMap(slots: SmSlotResult[], collapsed: ReadonlySet<number>): MapLayout {
  const lanesX = MAP_L.seatX + MAP_L.seatW + MAP_L.lanesGapX;
  let y = MAP_L.top;
  let maxCards = 0;
  const lanes = slots.map((slot, slotIndex) => {
    const isCollapsed = collapsed.has(slotIndex);
    const shown = slot.candidates.map((c, i) => ({ c, i })).filter(({ c }) => c.status !== 'cap_reached');
    maxCards = Math.max(maxCards, shown.length);
    const h = isCollapsed || shown.length === 0 ? MAP_L.laneHeadH : MAP_L.laneHeadH + MAP_L.cardH;
    const cards = isCollapsed ? [] : shown.map(({ i }, k) => ({ candidateIndex: i, x: lanesX + k * (MAP_L.cardW + MAP_L.gap), y: y + MAP_L.laneHeadH }));
    const lane = { slotIndex, y, h, collapsed: isCollapsed, cards };
    y += h + MAP_L.laneGap;
    return lane;
  });
  const laneW = Math.max(MAP_L.minLaneW, maxCards * (MAP_L.cardW + MAP_L.gap) - MAP_L.gap);
  return {
    seat: { x: MAP_L.seatX, y: MAP_L.top, w: MAP_L.seatW, h: MAP_L.seatH },
    lanesX,
    lanes,
    width: lanesX + laneW + 40,
    height: Math.max(y, MAP_L.top + MAP_L.seatH + 40),
  };
}
