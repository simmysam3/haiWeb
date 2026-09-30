import { describe, it, expect } from 'vitest';
import { vomeroDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmExecutionDetail2, SmCandidateResult2, SmOptionLimit2 } from '@/lib/sourcing-map/types';
import { SmEstimateResponseSchema, SmExecutionDetailSchema, SmExecutionStatusResponseSchema } from '@haiwave/protocol';
import multitierJson from '../execution-multitier.json';
import throttledJson from '../execution-throttled.json';
import estimateJson from '../estimate-may-wait.json';
import { CANDIDATE_NAMES, mayWaitEstimate, multitierDetail, throttledDetail, throttledStatus } from '..';

describe('SP2 types (validated by @haiwave/protocol 3.96.0)', () => {
  it('an SP1 (3.95.0-shaped) detail reads through the SP2 aliases: completed, no nodes, limit own', () => {
    const d: SmExecutionDetail2 = vomeroDetail;
    const c: SmCandidateResult2 = vomeroDetail.result!.slots[0]!.candidates[0]!;
    const limits: Array<SmOptionLimit2 | null> = vomeroDetail.result!.slots.flatMap((s) => s.candidates.map((x) => x.limit));
    expect(d.execution.status).toBe('completed');
    expect(c.nodes).toBeUndefined();
    expect(limits).toContain('own');
  });
});

describe('execution-multitier.json (contract §10)', () => {
  it('validates as a 3.96.0 SmExecutionDetail, strict at the top level (limit inputs is in the protocol enum)', () => {
    const parsed = SmExecutionDetailSchema.strict().parse(multitierJson);
    const d: SmExecutionDetail2 = parsed;
    expect(d.execution.status).toBe('completed');
  });

  it('tells the story: León limit inputs with a moderate trace to A, Mekong covers with A beneath, Zephyr own with E beneath, León not fully observed (a not_connected gap), shared exposure A/C/D', () => {
    const d = SmExecutionDetailSchema.parse(multitierJson);
    const r = d.result!;
    const leather = r.slots[0]!;
    const [leon, mekong, arno] = leather.candidates;
    expect(leon!.candidate_key).toBe('leon');
    expect(leon!.limit).toBe('inputs');
    expect(leon!.observed_below).toBe(false);
    expect(leon!.trace).toEqual({
      nodes: [{ alias: 'A', tier: 2, role: 'binding', band: 'moderate', binds_for: 1 }],
      edges: [{ parent: 'leon', child: 'A', band: 'moderate' }],
      gaps: [{ at: 'leon', status: 'not_connected' }],
    });
    expect(leon!.unobserved_from_tier).toBe(2);
    expect(mekong!.unobserved_from_tier).toBeNull();
    expect(leon!.nodes!.map((n) => [n.alias, n.tier, n.country, n.band])).toEqual([['A', 2, 'IT', 'moderate'], ['B', 2, 'US', null], ['C', 3, 'IN', null]]);
    expect(leon!.nodes![2]!.class).toEqual({ slug: 'cpt_colorants', label: 'Colorants', level: 2, of_levels: 4 });
    expect(mekong!.limit).toBeNull();
    expect(mekong!.nodes!.map((n) => n.alias)).toEqual(['A', 'F', 'C']);
    expect(mekong!.trace).toBeNull();
    expect(arno!.status).toBe('timeout');
    const zephyr = r.slots[3]!.candidates[0]!;
    expect(zephyr.limit).toBe('own');
    expect(zephyr.nodes!.map((n) => [n.alias, n.country])).toEqual([['E', 'TH']]);
    expect(r.shared_exposure).toEqual([
      { alias: 'A', tier: 2, under: ['leon', 'mekong'] },
      { alias: 'C', tier: 3, under: ['leon', 'mekong'] },
      { alias: 'D', tier: 2, under: ['flowknit', 'bowline'] },
    ]);
    expect(r.projection_k).toBe(3);
    expect(r.portfolio.first_short_drop).toBe('2027-03-15');
    // no name, id or quantity below tier 1: walk the RAW json (zod strips unknown keys, so a parsed walk could never fail)
    const rawNodes = multitierJson.result.slots.flatMap((s) => s.candidates.flatMap((c) => ('nodes' in c ? c.nodes : [])));
    expect(rawNodes.length).toBeGreaterThan(0);
    for (const n of rawNodes) {
      expect(Object.keys(n).sort()).toEqual(['alias', 'band', 'class', 'country', 'observed_below', 'tier']);
    }
  });
});

describe('execution-throttled.json and estimate-may-wait.json (contract §10)', () => {
  it('throttled: the detail is a throttled, incomplete SP1-shaped result with Arno waiting; the status frame names Arno (tier 1, G-52) and the hour', () => {
    const detail = SmExecutionDetailSchema.parse(throttledJson.detail);
    const status = SmExecutionStatusResponseSchema.parse(throttledJson.status);
    expect(detail.execution.status).toBe('throttled');
    expect(detail.execution.waiting_on).toEqual({ responder_name: 'Arno Pelli', refill_at: '2027-03-01T11:00:00.000Z' });
    expect(detail.execution.template_name).toBe('Chroma stress');
    expect(detail.result!.complete).toBe(false);
    expect(detail.result!.slots[0]!.candidates.map((c) => c.status)).toEqual(['answered', 'answered', 'waiting']);
    expect(detail.result!.slots[0]!.candidates.every((c) => c.nodes === undefined && c.trace === undefined)).toBe(true);
    expect(status).toMatchObject({ execution_id: detail.execution.execution_id, status: 'throttled', cursor: 3, changed: [] });
    expect(status.waiting_on).toEqual({ responder_name: 'Arno Pelli', refill_at: '2027-03-01T11:00:00.000Z' });
  });

  it('estimate: a 3.95.0 SmEstimateResponse whose one short responder plans more probes than its allowance (G-2: may_wait derives from it)', () => {
    const e = SmEstimateResponseSchema.parse(estimateJson);
    expect(e.responders_short).toEqual([{ participant_id: '5a1e0000-0000-4000-8000-000000000103', legal_name: 'Arno Pelli', probes_planned: 2, remaining_allowance: 1 }]);
    expect(e.responders_short.some((r) => r.probes_planned > r.remaining_allowance)).toBe(true);
  });
});

describe('fixture index', () => {
  it('exports the three fixtures typed, and the candidate names by key', () => {
    expect(multitierDetail.result!.slots[0]!.candidates[0]!.candidate_key).toBe('leon');
    expect(throttledDetail.execution.status).toBe('throttled');
    expect(throttledStatus.waiting_on!.responder_name).toBe('Arno Pelli');
    expect(mayWaitEstimate.responders_short).toHaveLength(1);
    expect(CANDIDATE_NAMES).toEqual({ leon: 'León Cuero', mekong: 'Mekong Tannery', arno: 'Arno Pelli', flowknit: 'FlowKnit Mills', bowline: 'Bowline Trim', zephyr: 'Zephyr Compounds' });
  });
});
