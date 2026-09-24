import { describe, it, expect } from 'vitest';
import { mixTotalsHundred } from '../contract';
import { largestRemainder, generateDrops, curveMix, normalizeMix, pairsFromMix, mixFromPairs, mixTotal } from '../demand-math';
import { MENS_US_7_13, SPRING_MIX } from '../__fixtures__/vomero';

describe('demand math', () => {
  it('largestRemainder splits a total into integers that sum exactly, ties to the earlier index', () => {
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(largestRemainder(7, [0, 0])).toEqual([4, 3]);
    expect(largestRemainder(0, [1, 2])).toEqual([0, 0]);
    for (const [total, weights] of [[6000, Object.values(SPRING_MIX)], [97, [1, 2, 3, 4, 5, 6]], [1, [0.3, 0.3, 0.4]]] as const) {
      const out = largestRemainder(total, weights);
      expect(out.reduce((a, b) => a + b, 0)).toBe(total);
      expect(out.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
    }
  });

  it('generates flat, ramp and front-loaded drops with exact totals, never a zero drop, and clamps month ends', () => {
    const flat = generateDrops({ total: 36000, first_due_date: '2027-01-15', spacing: 'monthly', count: 6, shape: 'flat' });
    expect(flat.ok && flat.drops).toEqual(
      ['2027-01-15', '2027-02-15', '2027-03-15', '2027-04-15', '2027-05-15', '2027-06-15'].map((d) => ({ due_date: d, qty: 6000, mix_override: null })),
    );
    const ramp = generateDrops({ total: 21, first_due_date: '2027-01-04', spacing: 'weekly', count: 6, shape: 'ramp' });
    expect(ramp.ok && ramp.drops.map((d) => d.qty)).toEqual([2, 2, 3, 4, 5, 5]);
    expect(ramp.ok && ramp.drops.map((d) => d.due_date)).toEqual(['2027-01-04', '2027-01-11', '2027-01-18', '2027-01-25', '2027-02-01', '2027-02-08']);
    const front = generateDrops({ total: 21, first_due_date: '2027-01-31', spacing: 'monthly', count: 3, shape: 'front_loaded' });
    expect(front.ok && front.drops.map((d) => [d.due_date, d.qty])).toEqual([['2027-01-31', 10], ['2027-02-28', 7], ['2027-03-31', 4]]);
    const tiny = generateDrops({ total: 10, first_due_date: '2027-01-04', spacing: 'weekly', count: 10, shape: 'ramp' });
    expect(tiny.ok && tiny.drops.every((d) => d.qty >= 1)).toBe(true);
    expect(generateDrops({ total: 5, first_due_date: '2027-01-04', spacing: 'weekly', count: 6, shape: 'flat' })).toEqual({ ok: false, message: 'The total must be a whole number of at least 6 (one per drop).' });
    expect(generateDrops({ total: 999, first_due_date: '2027-01-04', spacing: 'weekly', count: 53, shape: 'flat' })).toEqual({ ok: false, message: 'Drops must be between 1 and 52.' });
  });
});
