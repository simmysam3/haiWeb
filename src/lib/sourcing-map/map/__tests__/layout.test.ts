import { describe, it, expect } from 'vitest';
import { layoutMap, MAP_L, RAIL_L } from '../layout';
import { vomeroResult } from '../../__fixtures__/vomero';

describe('layoutMap', () => {
  it('places lanes and cards like the prototype, collapses a lane, and survives zero slots (Review Focus 5)', () => {
    const lanesX = MAP_L.seatX + MAP_L.seatW + MAP_L.lanesGapX;
    const l = layoutMap(vomeroResult.slots, new Set());
    expect(l.lanesX).toBe(336);
    expect(l.lanes).toHaveLength(5);
    expect(l.lanes[0]!.cards.map((c) => c.x)).toEqual([lanesX, lanesX + 252, lanesX + 504]);
    expect(l.lanes[3]!.cards).toEqual([]);
    // A lane without cards is its header: the rail's text (84) and the link gutter.
    expect(l.lanes[3]!.h).toBe(84 + RAIL_L.linkGutter);
    expect(l.width).toBe(336 + 740 + 40);
    expect(layoutMap(vomeroResult.slots, new Set([0])).lanes[0]).toMatchObject({ collapsed: true, h: 144 + RAIL_L.linkGutter, cards: [] });
    const empty = layoutMap([], new Set());
    expect(empty.lanes).toEqual([]);
    expect(Number.isFinite(empty.width) && Number.isFinite(empty.height)).toBe(true);
    expect(empty.width).toBe(336 + MAP_L.minLaneW + 40);
  });

  it("sizes each lane's header from the lines its rail shows and starts the cards one link gutter below them (walk B1, 2026-09-29)", () => {
    const l = layoutMap(vomeroResult.slots, new Set());
    // A plain rail: title 20, requirement 4 + 20, products 20, coverage 20.
    expect(l.lanes[4]!.textH).toBe(84);
    // A size-bound rail adds its label (16) and the 13-size strip: 11 cells fit a 740 px row, so two rows (4 + 18 + 4 + 18).
    expect(l.lanes[2]!.textH).toBe(84 + 16 + 44);
    for (const lane of l.lanes) {
      for (const card of lane.cards) expect(card.y).toBe(lane.y + lane.textH + RAIL_L.linkGutter);
    }
    l.lanes.slice(1).forEach((lane, i) => expect(lane.y).toBe(l.lanes[i]!.y + l.lanes[i]!.h + MAP_L.laneGap));
  });
});
