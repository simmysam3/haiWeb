import { describe, it, expect } from 'vitest';
import { vomeroDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmExecutionDetail2, SmCandidateResult2, SmOptionLimit2 } from '@/lib/sourcing-map/types';
import { SmExecutionDetailSchema } from '@haiwave/protocol';
import { SmExecutionDetailSchema2 } from '../schemas';
import multitierJson from '../execution-multitier.json';

describe('SP2 types (contract §3, typed locally until 3.96.0 is on the symlink)', () => {
  it('accepts every 3.95.0 value: an SP1 detail is an SmExecutionDetail2, and its limits are SmOptionLimit2', () => {
    const d: SmExecutionDetail2 = vomeroDetail;
    const c: SmCandidateResult2 = vomeroDetail.result!.slots[0]!.candidates[0]!;
    const limits: Array<SmOptionLimit2 | null> = vomeroDetail.result!.slots.flatMap((s) => s.candidates.map((x) => x.limit));
    expect(d.execution.status).toBe('completed');
    expect(c.nodes).toBeUndefined();
    expect(limits).toContain('own');
  });
});

describe('execution-multitier.json (contract §10)', () => {
  it('validates against contract §3 as an SmExecutionDetail2, and is NOT a 3.95.0 detail (limit inputs is new)', () => {
    const parsed = SmExecutionDetailSchema2.strict().parse(multitierJson);
    const d: SmExecutionDetail2 = parsed;
    expect(d.execution.status).toBe('completed');
    expect(SmExecutionDetailSchema.safeParse(multitierJson).success).toBe(false);
  });

  it('tells the story: León limit inputs with a moderate trace to A, Mekong covers with A beneath, Zephyr own with E beneath, León not fully observed (a not_connected gap), shared exposure A/C/D', () => {
    const d = SmExecutionDetailSchema2.parse(multitierJson);
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
