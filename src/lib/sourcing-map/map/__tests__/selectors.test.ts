import { describe, it, expect } from 'vitest';
import { heatOf, heatVar, formatPct, formatQty, formatDropDate } from '../selectors';

describe('map selectors', () => {
  it('colours links by the 90 / 70 thresholds and floors percentages', () => {
    expect([heatOf(1), heatOf(0.9), heatOf(0.8999), heatOf(0.7), heatOf(0.6999), heatOf(0)]).toEqual(['good', 'good', 'mid', 'mid', 'bad', 'bad']);
    expect([heatVar(0.95), heatVar(0.8), heatVar(0.5)]).toEqual(['var(--sm-heat-good)', 'var(--sm-heat-mid)', 'var(--sm-heat-bad)']);
    expect([formatPct(0.81666), formatPct(0.999), formatPct(1), formatPct(0.29)]).toEqual(['81%', '99%', '100%', '29%']);
    expect(formatQty(24300)).toBe('24,300');
    expect(formatDropDate('2027-03-15')).toBe('Mar 15');
  });
});
