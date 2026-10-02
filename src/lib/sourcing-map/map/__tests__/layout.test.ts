import { describe, it, expect } from 'vitest';
import { layoutMap, MAP_L, RAIL_L, sp2LinesHeight, tierRowsHeight, tiersOf } from '../layout';
import { vomeroResult } from '../../__fixtures__/vomero';
import { multitierDetail } from '@/app/sourcing-map/__fixtures__/sp2';
import { notTracedDetail } from '@/app/sourcing-map/__fixtures__/sp3';

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
  it("grows a lane's cards by one row per tier present under any of its cards (SP2 tier rows), and not at all for an SP1 slot", () => {
    const slots = multitierDetail.result!.slots;
    expect(tiersOf(slots[0]!.candidates[0]!.nodes!)).toEqual([2, 3]);
    expect(tiersOf([])).toEqual([]);
    expect(tierRowsHeight(slots[0]!)).toBe(MAP_L.tierRowsTop + 2 * MAP_L.tierRowH); // León: tiers 2 and 3
    expect(tierRowsHeight(slots[3]!)).toBe(MAP_L.tierRowsTop + MAP_L.tierRowH);     // Zephyr: tier 2 only
    expect(tierRowsHeight(vomeroResult.slots[0]!)).toBe(0);
    const l = layoutMap(slots, new Set());
    expect(l.lanes[0]!.cardH).toBe(MAP_L.cardH + MAP_L.tierRowsTop + 2 * MAP_L.tierRowH + sp2LinesHeight(slots[0]!));
    expect(l.lanes[0]!.h).toBe(l.lanes[0]!.textH + RAIL_L.linkGutter + l.lanes[0]!.cardH);
    expect(l.lanes[1]!.y).toBe(l.lanes[0]!.y + l.lanes[0]!.h + MAP_L.laneGap);
    const collapsed = layoutMap(slots, new Set([0]));
    expect(collapsed.lanes[0]!.h).toBe(collapsed.lanes[0]!.textH + RAIL_L.linkGutter);
    expect(layoutMap(vomeroResult.slots, new Set()).lanes.every((ln) => ln.cardH === MAP_L.cardH)).toBe(true);
  });

  it("reserves a lane's SP2 card lines — a tiered limit's second line and the unobserved note — so no card overflows its box (Task 13 R2, measured in chromium); SP1 lanes keep their numbers", () => {
    const slots = multitierDetail.result!.slots;
    const [leon, mekong] = slots[0]!.candidates;
    // measured: León's "Limit: constraint returned by current source, tier 2" wraps to a second 16 px line, and
    // "not fully observed below tier 2" is a line of its own (4 px margin + 16); the leather lane was 36 px short
    expect(MAP_L.limitWrapH).toBe(16);
    expect(MAP_L.noteLineH).toBe(20);
    expect(sp2LinesHeight(slots[0]!)).toBe(36);
    const l = layoutMap(slots, new Set());
    expect(l.lanes.map((ln) => ln.cardH)).toEqual([212 + 60 + 36, 212 + 34, 212 + 34, 212 + 34]);
    expect(l.lanes[1]!.y).toBe(l.lanes[0]!.y + l.lanes[0]!.textH + RAIL_L.linkGutter + 308 + MAP_L.laneGap);
    // `both` wraps as `inputs` does; Zephyr's `own` ("Limit: own capacity") is one line
    const zephyr = slots[3]!.candidates[0]!;
    expect(sp2LinesHeight(slots[3]!)).toBe(0);
    expect(sp2LinesHeight({ ...slots[3]!, candidates: [{ ...zephyr, limit: 'both' }] })).toBe(16);
    // a gap card shows neither line, so a lane whose only such card is a gap reserves nothing
    expect(sp2LinesHeight({ ...slots[0]!, candidates: [{ ...leon!, status: 'timeout' }, mekong!] })).toBe(0);
    // SP1 (Review Focus 1): no SP2 line on any card, so every lane keeps 212 and its y
    expect(vomeroResult.slots.every((slot) => sp2LinesHeight(slot) === 0)).toBe(true);
    expect(layoutMap(vomeroResult.slots, new Set()).lanes.map((ln) => [ln.y, ln.cardH])).toEqual(
      layoutMap(vomeroResult.slots, new Set()).lanes.map((ln) => [ln.y, MAP_L.cardH]),
    );
  });

  it("reserves the two lines of the not-traced copy in a lane whose answered card carries it: 212 + Mekong's two tier rows + notTracedH (G-5)", () => {
    expect(MAP_L.notTracedH).toBe(36);
    const slots = notTracedDetail.result!.slots;
    expect(sp2LinesHeight(slots[0]!)).toBe(36);
    expect(layoutMap(slots, new Set()).lanes[0]!.cardH).toBe(212 + 60 + 36);
  });
});
