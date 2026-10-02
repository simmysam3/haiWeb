import { describe, it, expect } from 'vitest';
import { vomeroDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmCandidateResult2, SmSubtierNode, SmSupplyRisk } from '@/lib/sourcing-map/types';

describe('SP3 types (protocol 3.97.0, re-exported type-only)', () => {
  it('compiles: not_traced_below on a node (present control), the SP2 alias, and the backlog types', () => {
    const n: SmSubtierNode = { alias: 'A', tier: 2, country: null, class: null, band: null, observed_below: false, not_traced_below: true };
    const c: SmCandidateResult2 = vomeroDetail.result!.slots[0]!.candidates[0]!;
    const s: SmSupplyRisk['status'] = 'open';
    expect(n.not_traced_below).toBe(true);
    expect(c).toBeDefined();
    expect(s).toBe('open');
  });
});
