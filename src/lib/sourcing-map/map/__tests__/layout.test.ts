import { describe, it, expect } from 'vitest';
import { layoutMap, MAP_L } from '../layout';
import { vomeroResult } from '../../__fixtures__/vomero';

describe('layoutMap', () => {
  it('places lanes and cards like the prototype, collapses a lane, and survives zero slots (Review Focus 5)', () => {
    const lanesX = MAP_L.seatX + MAP_L.seatW + MAP_L.lanesGapX;
    const l = layoutMap(vomeroResult.slots, new Set());
    expect(l.lanesX).toBe(336);
    expect(l.lanes).toHaveLength(5);
    expect(l.lanes[0]!.cards.map((c) => c.x)).toEqual([lanesX, lanesX + 252, lanesX + 504]);
    expect(l.lanes[3]!.cards).toEqual([]);
    expect(l.lanes[3]!.h).toBe(MAP_L.laneHeadH);
    expect(l.width).toBe(336 + 740 + 40);
    expect(layoutMap(vomeroResult.slots, new Set([0])).lanes[0]).toMatchObject({ collapsed: true, h: MAP_L.laneHeadH, cards: [] });
    const empty = layoutMap([], new Set());
    expect(empty.lanes).toEqual([]);
    expect(Number.isFinite(empty.width) && Number.isFinite(empty.height)).toBe(true);
    expect(empty.width).toBe(336 + MAP_L.minLaneW + 40);
  });
});
