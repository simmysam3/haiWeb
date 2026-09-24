import { describe, it, expect } from 'vitest';
import { heatOf, heatVar, formatPct, formatQty, formatDropDate, formatAsOfUtc, defaultAsOfDrop, resolveAsOfDrop, availabilityText, limitText, gapText } from '../selectors';
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

  it('words availability in the D-148 form, each limit, and every gap status as itself, never as zero or full coverage (AC 15)', () => {
    const leather = vomeroResult.slots[0]!;
    const week = '2027-02-22';
    const [leon, mekong] = leather.candidates;
    expect(availabilityText(leon!, week, 12000, 'sq ft')).toBe('Can cover 5,000 of 12,000 sq ft');
    expect(availabilityText(mekong!, week, 12000, 'sq ft')).toBe('Covers full 12,000 sq ft');
    expect(availabilityText({ ...leon!, availability_form: 'verdict' }, week, 12000, 'sq ft')).toBe('No, cannot cover in full');
    expect(availabilityText({ ...mekong!, availability_form: 'verdict' }, week, 12000, 'sq ft')).toBe('Yes, can cover in full');
    expect(availabilityText({ ...leon!, availability_form: 'not_probed_trust' }, week, 12000, 'sq ft')).toBe('Not probed at this trust level');
    expect(availabilityText(leon!, null, 0, 'sq ft')).toBe('No demand yet');
    expect([limitText('own'), limitText('lead_time'), limitText('unknown'), limitText(null)]).toEqual([
      'Limit: own capacity', 'Limit: lead time exceeds window', 'Schedule not assessed', 'No limit at the full requirement',
    ]);
    expect(['declined', 'timeout', 'unreachable', 'not_connected', 'rate_limited', 'cap_reached', 'probing', 'answered', 'unsupported'].map((s) => gapText(s as never))).toEqual([
      'No answer · declined', 'No answer · timeout', 'No answer · unreachable', 'No answer · not connected',
      'No answer · rate limited', 'Not probed · cap reached', 'Probing', null, null,
    ]);
  });

  it('formats an "as of" instant in UTC on a 24-hour clock, the one format the workspace shares (controller ruling R3)', () => {
    expect(formatAsOfUtc('2026-09-23T10:42:00.000Z')).toBe('Sep 23, 10:42 UTC');
    expect(formatAsOfUtc('2026-09-24T00:05:00.000Z')).toBe('Sep 24, 00:05 UTC');
  });
});
