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
});
