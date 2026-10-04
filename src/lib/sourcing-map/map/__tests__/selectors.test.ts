import { describe, it, expect } from 'vitest';
import { capacityExists, laneState, heatOf, heatVar, formatPct, formatQty, formatDropDate, formatDay, formatAsOfUtc, defaultAsOfDrop, resolveAsOfDrop, availabilityText, limitText, gapText, applyStatusDelta } from '../selectors';
import { vomeroResult, runningDetail, vomeroEstimate } from '../../__fixtures__/vomero';
import { CANDIDATE_NAMES, mayWaitEstimate, multitierDetail, throttledStatus } from '@/app/sourcing-map/__fixtures__/sp2';
import { bandVar, bandWord, bindingNodes, bindingRows, formatHourUtc, mayWaitNames, pathSummary, throttledText, bindingTier, nodeOf, traceSentence, traceable, cardSummaryText, utilizationText, underOf, candidateKeyOf, gapStubText, limitReason, unobservedTier, candidateNamesOf, sharedBindingText } from '../selectors';
import type { SmCandidateResult2 } from '../../types';
import { availabilityReason, HEAT_GOOD, HEAT_MID, otherTiers } from '../selectors';
import { compareDetail } from '@/app/sourcing-map/__fixtures__/lf';
import { modalBand, nodeTallies, pathGroups, utilBandWord } from '../selectors';

describe('map selectors', () => {
  it('formats a date or an instant with the year (UTC)', () => {
    expect(formatDay('2026-07-24')).toBe('Jul 24, 2026');
    expect(formatDay('2026-07-24T16:57:29.300Z')).toBe('Jul 24, 2026');
  });

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

  it("words availability and each limit as what the supplier stated, claiming no cause that a tier-1 answer cannot show, and every gap status as itself (AC 15; owner's walk ruling, 2026-09-29)", () => {
    const leather = vomeroResult.slots[0]!;
    const week = '2027-02-22';
    const [leon, mekong] = leather.candidates;
    expect(availabilityText(leon!, week, 12000, 'sq ft')).toBe('States 5,000 of 12,000 sq ft');
    expect(availabilityText(mekong!, week, 12000, 'sq ft')).toBe('States the full 12,000 sq ft');
    expect(availabilityText({ ...leon!, availability_form: 'verdict' }, week, 12000, 'sq ft')).toBe('States it cannot cover in full');
    expect(availabilityText({ ...mekong!, availability_form: 'verdict' }, week, 12000, 'sq ft')).toBe('States it can cover in full');
    expect(availabilityText({ ...leon!, availability_form: 'not_probed_trust' }, week, 12000, 'sq ft')).toBe('Not probed at this trust level');
    expect(availabilityText(leon!, null, 0, 'sq ft')).toBe('No demand yet');
    expect([limitText('own'), limitText('lead_time'), limitText('unknown'), limitText(null)]).toEqual([
      'Short · cause not traced', 'Stated supply starts after the first need date', 'Schedule not assessed', 'No shortfall stated',
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

  it("reads a lane in three states: the plan as allocated meets the requirement, it is short while stated capacity could cover it, or stated capacity cannot (owner's walk ruling, 2026-09-29)", () => {
    const leather = vomeroResult.slots[0]!;
    const week = '2027-02-22';
    // As allocated (León 60%, Mekong 40%) leather is covered 81%, and Mekong states the full requirement.
    expect(laneState(leather, week)).toBe('reallocate');
    const covered = (ratio: number) => ({ ...leather, coverage: leather.coverage.map((c) => (c.week === week ? { ...c, coverage: ratio } : c)) });
    expect(laneState(covered(1), week)).toBe('met');
    // Without Mekong's answer León's 5,000 of 12,000 is all that is stated.
    const noMekong = { ...leather, candidates: leather.candidates.map((c, i) => (i === 1 ? { ...c, status: 'timeout' as const, weeks: [] } : c)) };
    expect(laneState(noMekong, week)).toBe('short');
    // No drop shown, or no demand row for the week: nothing to judge.
    expect(laneState(leather, null)).toBeNull();
    expect(laneState(leather, '2031-01-06')).toBeNull();
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

const mt = multitierDetail.result!;
const [leon2, mekong2, arno2] = mt.slots[0]!.candidates;
const zephyr2 = mt.slots[3]!.candidates[0]!;

describe('SP2 selectors: bands, keys, tiers and the limit reason (spec §12.2, contract §10)', () => {
  it('maps bands to the heat tokens and their words; keys a card by candidate_key, falling back to the participant id', () => {
    expect([bandVar('slight'), bandVar('moderate'), bandVar('severe')]).toEqual(['var(--sm-heat-good)', 'var(--sm-heat-mid)', 'var(--sm-heat-bad)']);
    expect([bandWord('slight'), bandWord('moderate'), bandWord('severe')]).toEqual(['slight', 'moderate', 'severe']);
    expect(candidateKeyOf(leon2!)).toBe('leon');
    expect(candidateKeyOf(vomeroResult.slots[0]!.candidates[0]!)).toBe('5a1e0000-0000-4000-8000-000000000101');
  });

  it('finds the binding tier from the trace, else from the shallowest banded node, else null', () => {
    expect(bindingTier(leon2!)).toBe(2);
    expect(bindingTier(mekong2!)).toBeNull();
    expect(bindingTier(zephyr2)).toBeNull();
    const bandedOnly: SmCandidateResult2 = { ...mekong2!, trace: null, nodes: [{ ...mekong2!.nodes![2]!, band: 'moderate' }] };
    expect(bindingTier(bandedOnly)).toBe(3);
  });

  it('reads the served unobserved_from_tier first (G-46), and derives it only when the field is absent: 2 when the gap is directly under the candidate, a flagged node’s tier + 1 otherwise, null when fully observed (Review Focus 5)', () => {
    expect(leon2!.unobserved_from_tier).toBe(2);
    expect(unobservedTier(leon2!)).toBe(2);
    expect(unobservedTier(mekong2!)).toBeNull();
    // the server's word wins over any derivation
    expect(unobservedTier({ ...leon2!, unobserved_from_tier: 3 })).toBe(3);
    expect(unobservedTier({ ...leon2!, unobserved_from_tier: null })).toBeNull();
    // no field (a result before SP2-a's composition filled it): the derivation
    const { unobserved_from_tier: _dropped, ...leonNoField } = leon2!;
    void _dropped;
    expect(unobservedTier(leonNoField)).toBe(2);
    const flaggedAt2: SmCandidateResult2 = { ...leonNoField, nodes: leon2!.nodes!.map((n) => (n.alias === 'A' ? { ...n, observed_below: false } : n)) };
    expect(unobservedTier(flaggedAt2)).toBe(3);
    const flaggedAt2And3: SmCandidateResult2 = { ...leonNoField, nodes: leon2!.nodes!.map((n) => ({ ...n, observed_below: false })) };
    expect(unobservedTier(flaggedAt2And3)).toBe(3);
    expect(unobservedTier(vomeroResult.slots[0]!.candidates[0]!)).toBeNull();
  });

  it('words the limit: SP2 candidates get the tiered reasons and "Limit: own capacity"; an SP1 candidate keeps the walk’s words (Review Focus 1)', () => {
    expect(limitReason(leon2!)).toBe('Limit: constraint returned by current source, tier 2');
    expect(limitReason({ ...leon2!, limit: 'both' })).toBe('Limit: own capacity and tier 2 source');
    expect(limitReason({ ...leon2!, limit: 'inputs', trace: null, nodes: [{ ...leon2!.nodes![2]!, band: 'slight' }] })).toBe('Limit: constraint returned by current source, tier 3');
    expect(limitReason({ ...leon2!, limit: 'inputs', trace: null, nodes: [] })).toBe('Limit: constraint returned by current source, tier 2');
    expect(limitReason(zephyr2)).toBe('Limit: own capacity');
    expect(limitReason(mekong2!)).toBe('No shortfall stated');
    expect(limitReason({ ...mekong2!, limit: 'lead_time' })).toBe('Stated supply starts after the first need date');
    expect(limitReason({ ...mekong2!, limit: 'unknown' })).toBe('Schedule not assessed');
    const sp1Leon = vomeroResult.slots[0]!.candidates[0]!;
    expect(sp1Leon.limit).toBe('own');
    expect(limitReason(sp1Leon)).toBe('Short · cause not traced');
    expect(limitReason({ ...sp1Leon, limit: null })).toBe('No shortfall stated');
  });

  it('switches on the limit first (controller ruling 2): a live SP2 candidate with limit inputs but no projection yet reads the tiered words, the tier falling through binding tier, then the served unobserved tier, then 2; an SP1 own has no nodes and reads the walk’s words', () => {
    const live: SmCandidateResult2 = { ...leon2!, nodes: undefined, trace: undefined };
    expect(live.limit).toBe('inputs');
    expect(limitReason(live)).toBe('Limit: constraint returned by current source, tier 2');
    expect(limitReason({ ...live, limit: 'both' })).toBe('Limit: own capacity and tier 2 source');
    // middle term: the served unobserved tier is used when nothing binds
    expect(limitReason({ ...live, unobserved_from_tier: 3 })).toBe('Limit: constraint returned by current source, tier 3');
    // last term: a status-delta candidate before composition has no binding tier and no unobserved tier
    const { unobserved_from_tier: _dropped, ...bare } = live;
    void _dropped;
    expect(limitReason({ ...bare, observed_below: true })).toBe('Limit: constraint returned by current source, tier 2');
    const sp1Own: SmCandidateResult2 = { ...live, limit: 'own' };
    expect(limitReason(sp1Own)).toBe('Short · cause not traced');
  });
});

describe('SP2 selectors: waiting and the gap stubs (contract §10)', () => {
  it('words a waiting card as itself, never as answered, and every gap stub with its status word', () => {
    expect(gapText('waiting')).toBe('Waiting · hourly allowance');
    expect(['declined', 'rate_limited', 'not_connected', 'cap_reached', 'timeout', 'unreachable', 'unsupported'].map((s) => gapStubText(s as never))).toEqual([
      'not observed below: declined', 'not observed below: rate limited', 'not observed below: not connected', 'not observed below: cap reached',
      'not observed below: timeout', 'not observed below: unreachable', 'not observed below: unsupported',
    ]);
  });
});

describe('SP2 selectors: shared aliases, binding nodes and the trace sentence', () => {
  // León and Mekong both bind alias A (binds_for 2): the SP2 fixture has no shared binding of its own
  const buildTwice = () => {
    const twice = structuredClone(mt);
    twice.slots[0]!.candidates[1]!.limit = 'inputs';
    twice.slots[0]!.candidates[1]!.trace = { nodes: [{ alias: 'A', tier: 2, role: 'binding', band: 'slight', binds_for: 2 }], edges: [{ parent: 'mekong', child: 'A', band: 'slight' }], gaps: [] };
    twice.slots[0]!.candidates[0]!.trace!.nodes[0]!.binds_for = 2;
    return twice;
  };

  it('lists the options an alias sits under, in display order, and finds its node (the preferred option’s first)', () => {
    expect(underOf(mt, 'A')).toEqual(['leon', 'mekong']);
    expect(underOf(mt, 'D')).toEqual(['flowknit', 'bowline']);
    expect(underOf(mt, 'E')).toEqual(['zephyr']);
    expect(underOf(mt, 'Z')).toEqual([]);
    expect(nodeOf(mt, 'A')!.band).toBe('moderate');
    expect(nodeOf(mt, 'A', 'mekong')!.band).toBeNull();
    expect(nodeOf(mt, 'Z')).toBeNull();
  });

  it('collects every binding node once with the options it binds, in display order', () => {
    expect(bindingNodes(mt)).toEqual([{ alias: 'A', tier: 2, options: [{ slot: 0, candidate: 0, key: 'leon', name: 'León Cuero', binds_for: 1 }] }]);
    const twice = buildTwice();
    expect(bindingNodes(twice)[0]!.options.map((o) => o.key)).toEqual(['leon', 'mekong']);
    expect(bindingNodes(vomeroResult)).toEqual([]);
  });

  it('lists an option’s binding nodes with tier, band and binds_for from the trace, and country and class from its own nodes (§8.2)', () => {
    expect(bindingRows(leon2!)).toEqual([{ alias: 'A', tier: 2, band: 'moderate', binds_for: 1, country: 'IT', classLabel: 'Dyes' }]);
    expect(bindingRows(mekong2!)).toEqual([]);
    // the trace's tier is the row's tier; an inherited node is not a binding source
    const inline = structuredClone(leon2!);
    inline.trace = { nodes: [{ alias: 'C', tier: 3, role: 'inherited', band: 'slight', binds_for: 1 }, { alias: 'B', tier: 3, role: 'binding', band: 'severe', binds_for: 1 }], edges: [], gaps: [] };
    expect(bindingRows(inline)).toEqual([{ alias: 'B', tier: 3, band: 'severe', binds_for: 1, country: 'US', classLabel: 'Wet-blue' }]);
    // a binding alias this option's nodes do not hold has no country and no class
    const absent = structuredClone(leon2!);
    absent.trace = { nodes: [{ alias: 'Z', tier: 4, role: 'binding', band: 'slight', binds_for: 1 }], edges: [], gaps: [] };
    expect(bindingRows(absent)).toEqual([{ alias: 'Z', tier: 4, band: 'slight', binds_for: 1, country: null, classLabel: null }]);
  });

  it('names the other options a shared binding source limits, each from its own side (A3)', () => {
    const twice = buildTwice();
    const [leon, mekong] = twice.slots[0]!.candidates;
    const tail = 'splitting between these options will not relieve the constraint.';
    expect(sharedBindingText(twice, leon!)).toBe(`The same source limits Mekong Tannery; ${tail}`);
    expect(sharedBindingText(twice, mekong!)).toBe(`The same source limits León Cuero; ${tail}`);
  });

  it('lists three options with the conjunction, in first-seen order (A3)', () => {
    const three = buildTwice();
    const slots = three.slots;
    slots[1]!.candidates[0]!.trace = { nodes: [{ alias: 'A', tier: 2, role: 'binding', band: 'slight', binds_for: 3 }], edges: [{ parent: 'flowknit', child: 'A', band: 'slight' }], gaps: [] };
    slots[0]!.candidates[0]!.trace!.nodes[0]!.binds_for = 3;
    slots[0]!.candidates[1]!.trace!.nodes[0]!.binds_for = 3;
    expect(sharedBindingText(three, slots[0]!.candidates[0]!)).toBe('The same source limits Mekong Tannery and FlowKnit Mills; splitting between these options will not relieve the constraint.');
  });

  it('says nothing when the source binds one option, or when no peer resolves (A3, AR-4)', () => {
    expect(sharedBindingText(mt, leon2!)).toBeNull();
    const lone = structuredClone(mt);
    lone.slots[0]!.candidates[0]!.trace!.nodes[0]!.binds_for = 2;
    expect(sharedBindingText(lone, lone.slots[0]!.candidates[0]!)).toBeNull();
    expect(sharedBindingText(mt, mekong2!)).toBeNull();
    // a peer exists, but this option's own node binds for one: the gate is binds_for, not the role alone
    const gated = buildTwice();
    gated.slots[0]!.candidates[0]!.trace!.nodes[0]!.binds_for = 1;
    expect(sharedBindingText(gated, gated.slots[0]!.candidates[0]!)).toBeNull();
  });

  it('says the trace in one sentence: each edge with its band, the binding node and tier, each gap with its status word', () => {
    expect(traceSentence(leon2!.trace!, CANDIDATE_NAMES)).toBe('León Cuero → A (moderate); binding: A (tier 2); not observed below León Cuero: not connected');
    const deep = { nodes: [{ alias: 'A', tier: 2, role: 'inherited' as const, band: 'moderate' as const, binds_for: 1 }, { alias: 'C', tier: 3, role: 'binding' as const, band: 'severe' as const, binds_for: 2 }],
      edges: [{ parent: 'leon', child: 'A', band: 'moderate' as const }, { parent: 'A', child: 'C', band: 'severe' as const }], gaps: [] };
    expect(traceSentence(deep, CANDIDATE_NAMES)).toBe('León Cuero → A (moderate); A → C (severe); binding: C (tier 3), for 2 options');
  });

  it('a card is traceable when its trace has at least one edge or gap (A2)', () => {
    expect(traceable(leon2!)).toBe(true);
    expect(traceable(mekong2!)).toBe(false);
    expect(traceable({ ...leon2!, trace: { nodes: [], edges: [], gaps: [] } })).toBe(false);
    expect(traceable({ ...leon2!, trace: { nodes: [], edges: [], gaps: leon2!.trace!.gaps } })).toBe(true);
    expect(traceable({ ...leon2!, trace: { nodes: [], edges: leon2!.trace!.edges, gaps: [] } })).toBe(true);
  });

  it('says where else an alias sits, from either side, and nothing when its tier is the same everywhere (§8.3)', () => {
    const r = compareDetail.result!;
    expect(otherTiers(r, 'C', 'leon')).toEqual([{ tier: 2, names: ['Mekong Tannery'] }]);
    expect(otherTiers(r, 'C', 'mekong')).toEqual([{ tier: 3, names: ['León Cuero'] }]);
    expect(otherTiers(r, 'A', 'leon')).toEqual([]);
    expect(otherTiers(r, 'D', 'flowknit')).toEqual([]);
  });
});

describe('SP2 selectors: the wait sentence, may_wait and the path summary (spec §12.4, §12.5; G-2)', () => {
  it('words the wait with the responder and the hour boundary in UTC, exactly', () => {
    expect(formatHourUtc('2027-03-01T11:00:00.000Z')).toBe('11:00 UTC');
    expect(formatHourUtc('2027-03-01T23:00:00.000Z')).toBe('23:00 UTC');
    expect(throttledText(throttledStatus.waiting_on!)).toBe("Waiting for Arno Pelli's hourly allowance until 11:00 UTC — the run continues on its own.");
    // G-52: a responder below tier 1 is not named; before the first frame there is nothing to name
    expect(throttledText({ responder_name: null, refill_at: '2027-03-01T11:00:00.000Z' })).toBe('Waiting for an hourly allowance — the run continues on its own.');
    expect(throttledText(null)).toBe('Waiting for an hourly allowance — the run continues on its own.');
  });

  it('derives may_wait from responders_short: a responder planning more probes than its allowance may wait; none otherwise', () => {
    expect(mayWaitNames(mayWaitEstimate)).toEqual(['Arno Pelli']);
    expect(mayWaitNames(vomeroEstimate)).toEqual([]);
    expect(mayWaitNames({ ...vomeroEstimate, responders_short: [{ participant_id: '5a1e0000-0000-4000-8000-000000000103', legal_name: 'Arno Pelli', probes_planned: 1, remaining_allowance: 1 }] })).toEqual([]);
  });

  it("summarises what is beneath a card in one line: the responders and, when served, the median lead time; nothing for a gap card or an SP1 card (A4, AR-8)", () => {
    expect(cardSummaryText(leon2!)).toBe('3 responders · median 14 d');
    // FlowKnit: one responder, median null, so the clause drops (no "median null d", no dash)
    expect(cardSummaryText(mt.slots[1]!.candidates[0]!)).toBe('1 responder');
    // Arno timed out and carries aggregates: null, so there is nothing to count
    expect(arno2!.aggregates).toBeNull();
    expect(cardSummaryText(arno2!)).toBeNull();
    // a gap card that still carries aggregates has no beneath either
    expect(cardSummaryText({ ...leon2!, status: 'timeout' })).toBeNull();
    expect(cardSummaryText(vomeroResult.slots[0]!.candidates[0]!)).toBeNull();
  });

  it("reads the aggregates' utilization counts as words, every band always present, even at 0 (A4)", () => {
    expect(utilizationText({ low: 1, moderate: 1, high: 0, at_capacity: 1 })).toBe('1 low · 1 moderate · 0 high · 1 at capacity');
  });

  it('summarises the path: observed and not-observed inputs, and the binding tier when there is one; nothing for an SP1 candidate, nor for one that never answered (M-3)', () => {
    expect(pathSummary(leon2!)).toBe('Inputs: 3 observed, 1 not observed · binding at tier 2');
    expect(pathSummary(mekong2!)).toBe('Inputs: 3 observed, 0 not observed');
    expect(pathSummary(zephyr2)).toBe('Inputs: 1 observed, 0 not observed');
    // M-3: Arno timed out, so it has no observed inputs to count; "Inputs: 0 observed, 0 not observed" would misstate it
    expect(pathSummary(arno2!)).toBeNull();
    expect(pathSummary(vomeroResult.slots[0]!.candidates[0]!)).toBeNull();
  });
});

describe('candidateNamesOf', () => {
  it('maps every candidate_key to its supplier name (the SP2 map), and falls back to the participant id as the key for an SP1 result', () => {
    expect(candidateNamesOf(multitierDetail.result!)).toEqual(CANDIDATE_NAMES);
    const sp1 = candidateNamesOf(vomeroResult);
    const leon = vomeroResult.slots[0]!.candidates[0]!;
    expect(sp1[leon.supplier_participant_id]).toBe(leon.supplier_name);
    expect(Object.keys(sp1)).toHaveLength(new Set(vomeroResult.slots.flatMap((s) => s.candidates.map((c) => c.supplier_participant_id))).size);
  });
});

describe('availabilityReason: the pill tip says why the pill is in its state (owner, 2026-10-01)', () => {
  const leon = vomeroResult.slots[0]!.candidates[0]!;
  const week = '2027-02-22';
  /** León's answer at `week`, restated as `stated` of `asked`. */
  const at = (stated: number, asked: number): SmCandidateResult2 => ({
    ...leon,
    weeks: leon.weeks.map((w) => (w.week === week ? { ...w, cum_achievable: stated, option_coverage: stated / asked } : w)),
  });

  it('names the threshold a short answer meets: the live Zephyr figure, 23,869 of 25,500, meets the 90% threshold', () => {
    expect(availabilityReason(at(23869, 25500), week, 25500)).toBe('Covers 93% of the ask, which meets the 90% threshold.');
    expect(availabilityReason(at(9000, 10000), week, 10000)).toBe('Covers 90% of the ask, which meets the 90% threshold.');
  });

  it('says a full answer covers the full ask, by the same test as the pill text, not by a percentage', () => {
    expect(availabilityReason(at(12000, 12000), week, 12000)).toBe('Covers the full ask.');
  });

  it('says an answer from 70% up to 90% falls below the 90% threshold, the percentage floored as the pips floor it', () => {
    expect(availabilityReason(at(8200, 10000), week, 10000)).toBe('Covers 82% of the ask, below the 90% threshold.');
    expect(availabilityReason(at(8999, 10000), week, 10000)).toBe('Covers 89% of the ask, below the 90% threshold.');
    expect(availabilityReason(at(7000, 10000), week, 10000)).toBe('Covers 70% of the ask, below the 90% threshold.');
  });

  it('says an answer under 70% falls below the 70% threshold', () => {
    expect(availabilityReason(at(5500, 10000), week, 10000)).toBe('Covers 55% of the ask, below the 70% threshold.');
    expect(availabilityReason(at(6999, 10000), week, 10000)).toBe('Covers 69% of the ask, below the 70% threshold.');
    expect(availabilityReason(at(0, 10000), week, 10000)).toBe('Covers 0% of the ask, below the 70% threshold.');
  });

  it('adds nothing where the pill grades nothing: not probed at this trust level, no demand yet, or no answer for the week', () => {
    expect(availabilityReason({ ...at(5500, 10000), availability_form: 'not_probed_trust' }, week, 10000)).toBeNull();
    expect(availabilityReason(at(5500, 10000), week, 0)).toBeNull();
    expect(availabilityReason(at(5500, 10000), null, 10000)).toBeNull();
    expect(availabilityReason(at(5500, 10000), '2031-01-06', 10000)).toBeNull();
  });

  it('takes its band and its numbers from the source the pill colour uses (heatOf, HEAT_GOOD, HEAT_MID), so the tip and the colour never disagree', () => {
    for (const stated of [9999, 9360, 9000, 8999, 7000, 6999, 3000]) {
      const ratio = stated / 10000;
      const heat = heatOf(ratio);
      const threshold = formatPct(heat === 'bad' ? HEAT_MID : HEAT_GOOD);
      expect(availabilityReason(at(stated, 10000), week, 10000)).toBe(`Covers ${formatPct(ratio)} of the ask, ${heat === 'good' ? 'which meets' : 'below'} the ${threshold} threshold.`);
    }
  });
});

describe('what is beneath an option: the selectors (LF step 5)', () => {
  const leon = compareDetail.result!.slots[0]!.candidates.find((c) => c.candidate_key === 'leon')!;

  it('names the modal utilization band: the largest count, the first of low, moderate, high, at capacity on a tie, and none when every count is 0 (§6.7, w10)', () => {
    expect(modalBand({ low: 0, moderate: 2, high: 1, at_capacity: 0 })).toBe('moderate');
    expect(modalBand(leon.aggregates!.utilization)).toBe('low');
    expect(modalBand({ low: 0, moderate: 0, high: 1, at_capacity: 1 })).toBe('high');
    expect(modalBand({ low: 0, moderate: 0, high: 0, at_capacity: 0 })).toBeNull();
    expect(utilBandWord('at_capacity')).toBe('at capacity');
  });

  const mekong = compareDetail.result!.slots[0]!.candidates.find((c) => c.candidate_key === 'mekong')!;

  it('tallies countries and classes over the option’s own nodes, by count then by name, never from the served lists (§8.1)', () => {
    expect(nodeTallies(mekong)).toEqual({ countries: [['IT', 2], ['IN', 1]], classes: [['Dyes', 2], ['Colorants', 1]] });
    expect(nodeTallies(leon)).toEqual({ countries: [['IN', 1], ['IT', 1], ['US', 1]], classes: [['Colorants', 1], ['Dyes', 1]] });
  });

  const shape = (c: SmCandidateResult2) => pathGroups(c).map((t) => ({ tier: t.tier, groups: t.groups.map((g) => ({ label: g.label, level: g.level, aliases: g.nodes.map((n) => n.alias) })) }));

  it('groups an option’s nodes by tier, then by class label and level, the no-class group last, nodes by alias (§7)', () => {
    expect(shape(leon)).toEqual([
      { tier: 2, groups: [{ label: 'Dyes', level: 4, aliases: ['A'] }, { label: null, level: null, aliases: ['B'] }] },
      { tier: 3, groups: [{ label: 'Colorants', level: 2, aliases: ['C'] }] },
    ]);
    expect(shape(mekong)).toEqual([
      { tier: 2, groups: [{ label: 'Colorants', level: 2, aliases: ['C'] }, { label: 'Dyes', level: 4, aliases: ['A', 'F'] }] },
    ]);
    // an inline option whose nodes arrive out of order comes back sorted
    expect(shape({ ...mekong, nodes: [...mekong.nodes!].reverse() })).toEqual(shape(mekong));
  });
});
