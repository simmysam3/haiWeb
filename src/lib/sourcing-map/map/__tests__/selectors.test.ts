import { describe, it, expect } from 'vitest';
import { heatOf, heatVar, formatPct, formatQty, formatDropDate, defaultAsOfDrop, resolveAsOfDrop } from '../selectors';
import { vomeroResult } from '../../__fixtures__/vomero';

describe('map selectors', () => {
  it('colours links by the 90 / 70 thresholds and floors percentages', () => {
    expect([heatOf(1), heatOf(0.9), heatOf(0.8999), heatOf(0.7), heatOf(0.6999), heatOf(0)]).toEqual(['good', 'good', 'mid', 'mid', 'bad', 'bad']);
    expect([heatVar(0.95), heatVar(0.8), heatVar(0.5)]).toEqual(['var(--sm-heat-good)', 'var(--sm-heat-mid)', 'var(--sm-heat-bad)']);
    expect([formatPct(0.81666), formatPct(0.999), formatPct(1), formatPct(0.29)]).toEqual(['81%', '99%', '100%', '29%']);
    expect(formatQty(24300)).toBe('24,300');
    expect(formatDropDate('2027-03-15')).toBe('Mar 15');
  });

  it('defaults the as-of drop to the first short drop, else the last, and honours a ?drop= that names a drop (spec §9.3)', () => {
    const p = vomeroResult.portfolio;
    expect(defaultAsOfDrop(p)).toBe('2027-03-15');
    expect(defaultAsOfDrop({ ...p, first_short_drop: null })).toBe('2027-06-15');
    expect(defaultAsOfDrop({ ...p, drops: [], first_short_drop: null })).toBeNull();
    expect(resolveAsOfDrop('2027-04-15', p)).toBe('2027-04-15');
    expect(resolveAsOfDrop('2031-01-01', p)).toBe('2027-03-15');
  });
});
