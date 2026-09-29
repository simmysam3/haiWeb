import { describe, it, expect } from 'vitest';
import { capacityExists, heatOf, heatVar, formatPct, formatQty, formatDropDate, formatAsOfUtc, defaultAsOfDrop, resolveAsOfDrop, availabilityText, limitText, gapText, applyStatusDelta } from '../selectors';
import { vomeroResult, runningDetail } from '../../__fixtures__/vomero';

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

  it("says capacity exists when the suppliers' stated quantities together meet the requirement, allocated or not (owner's walk ruling, 2026-09-29)", () => {
    const leather = vomeroResult.slots[0]!;
    const week = '2027-02-22';
    // León states 5,000 of 12,000 and holds 60% of the allocation; Mekong states the full 12,000.
    expect(capacityExists(leather, week)).toBe(true);
    const totals = (a: number, b: number) => ({
      ...leather,
      candidates: leather.candidates.map((c, i) => ({
        ...c,
        weeks: c.weeks.map((w) => (w.week === week ? { ...w, cum_achievable: i === 0 ? a : b, cum_achievable_by_variant: null } : w)),
      })),
    });
    // Two suppliers who each state 60% can cover it between them; at 40% each they cannot.
    expect(capacityExists(totals(7200, 7200), week)).toBe(true);
    expect(capacityExists(totals(4800, 4800), week)).toBe(false);
    // A supplier with no answer states nothing.
    expect(capacityExists({ ...leather, candidates: leather.candidates.map((c, i) => (i === 1 ? { ...c, status: 'timeout' as const, weeks: [] } : c)) }, week)).toBe(false);
    // No drop shown, or a week the slot has no demand row for: nothing to judge.
    expect(capacityExists(leather, null)).toBeNull();
    expect(capacityExists(leather, '2031-01-06')).toBeNull();
  });

  it('judges a size-bound slot size by size: totals that add up do not make up for a size nobody can supply', () => {
    const leather = vomeroResult.slots[0]!;
    const week = '2027-02-22';
    const without9 = {
      ...leather,
      candidates: leather.candidates.map((c) => ({
        ...c,
        weeks: c.weeks.map((w) => (w.week === week && w.cum_achievable_by_variant ? { ...w, cum_achievable: 12000, cum_achievable_by_variant: { ...w.cum_achievable_by_variant, '9': 0 } } : w)),
      })),
    };
    // Both suppliers state the full 12,000 in total, and neither any size 9.
    expect(capacityExists(without9, week)).toBe(false);
    // One supplier stating its size 9 in full is enough.
    const mekong9 = leather.candidates[1]!.weeks.find((w) => w.week === week)!.cum_achievable_by_variant!['9']!;
    const restored = { ...without9, candidates: without9.candidates.map((c, i) => (i === 1 ? { ...c, weeks: c.weeks.map((w) => (w.week === week ? { ...w, cum_achievable_by_variant: { ...w.cum_achievable_by_variant!, '9': mekong9 } } : w)) } : c)) };
    expect(capacityExists(restored, week)).toBe(true);
  });

  it('finds capacity for a week that asks for nothing, however the suppliers answered', () => {
    const leather = vomeroResult.slots[0]!;
    const week = '2027-02-22';
    const nothingAsked = {
      ...leather,
      demand: leather.demand.map((d) => (d.week === week ? { ...d, cum_qty: 0, cum_qty_by_variant: Object.fromEntries(Object.keys(d.cum_qty_by_variant!).map((v) => [v, 0])) } : d)),
      candidates: leather.candidates.map((c) => ({ ...c, weeks: c.weeks.map((w) => (w.week === week ? { ...w, cum_achievable: 0, cum_achievable_by_variant: null } : w)) })),
    };
    expect(capacityExists(nothingAsked, week)).toBe(true);
  });

  it('formats an "as of" instant in UTC on a 24-hour clock, the one format the workspace shares (controller ruling R3)', () => {
    expect(formatAsOfUtc('2026-09-23T10:42:00.000Z')).toBe('Sep 23, 10:42 UTC');
    expect(formatAsOfUtc('2026-09-24T00:05:00.000Z')).toBe('Sep 24, 00:05 UTC');
  });

  it('applies a status delta only to candidates that exist: an out-of-range slot or candidate index is ignored, never a hole (M2)', () => {
    const running = runningDetail().result!;
    const answered = vomeroResult.slots[0]!.candidates[1]!;
    const count = running.slots[0]!.candidates.length;
    const out = applyStatusDelta(running, {
      execution_id: '5a1e0000-0000-4000-8000-000000000031', status: 'running', failure_reason: null, probes_planned: 7, probes_done: 4, cursor: 4,
      changed: [
        { slot_index: 0, candidate_index: 1, candidate: answered },
        { slot_index: 0, candidate_index: count, candidate: answered },
        { slot_index: running.slots.length, candidate_index: 0, candidate: answered },
      ],
    });
    expect(out.slots[0]!.candidates[1]).toBe(answered);
    expect(out.slots[0]!.candidates).toHaveLength(count);
    expect(out.slots).toHaveLength(running.slots.length);
  });
});
