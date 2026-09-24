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

  it('curveMix (the prototype curve) totals exactly 10,000 hundredths, peaks at the center, and honours half sizes', () => {
    const mix = curveMix(MENS_US_7_13, { center: '9.5', spread: 1.5, half_sizes: true });
    const hundredths = MENS_US_7_13.map((v) => Math.round(mix[v]! * 100));
    expect(hundredths.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(mixTotalsHundred(mix)).toBe(true);
    expect(Math.max(...Object.values(mix))).toBe(mix['9.5']);
    // D19: compared in hundredths; 13.09 − 13.08 in doubles is only just under 0.01.
    expect(Math.abs(Math.round(mix['9']! * 100) - Math.round(mix['10']! * 100))).toBeLessThanOrEqual(1);
    expect(mix['7']! < mix['8']! && mix['13']! < mix['12']!).toBe(true);
    const whole = curveMix(MENS_US_7_13, { center: '9.5', spread: 1.5, half_sizes: false });
    expect(whole['9.5']).toBe(0);
    expect(mixTotalsHundred(whole)).toBe(true);
    expect(curveMix(['S', 'M', 'L'], { center: 'M', spread: 1, half_sizes: false })).toEqual({ S: 33.34, M: 33.33, L: 33.33 });
  });

  it('normalizes a hand-typed 99.98% mix to exactly 100.00, splits a quantity into pairs by the mix (exact sum), and derives a mix back from pairs', () => {
    const typed = { '9': 33.33, '10': 33.33, '11': 33.32 };
    expect(mixTotal(typed)).toBe(99.98);
    const fixed = normalizeMix(typed, ['9', '10', '11']);
    // largest remainder over 10,000 hundredths: 3333.67, 3333.67, 3332.67 → the two leftovers go to the earlier ties.
    expect(fixed).toEqual({ '9': 33.34, '10': 33.34, '11': 33.32 });
    expect(mixTotalsHundred(fixed)).toBe(true);
    expect(mixTotal(fixed)).toBe(100);
    const pairs = pairsFromMix(6000, SPRING_MIX, MENS_US_7_13);
    expect(Object.values(pairs).reduce((a, b) => a + b, 0)).toBe(6000);
    expect(pairs['9.5']).toBe(830);
    expect(mixFromPairs({ '9': 1, '10': 2 }, ['9', '10'])).toEqual({ '9': 33.33, '10': 66.67 });
    expect(mixTotalsHundred(mixFromPairs(pairs, MENS_US_7_13))).toBe(true);
  });
});
