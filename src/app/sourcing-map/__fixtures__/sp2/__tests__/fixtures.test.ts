import { describe, it, expect } from 'vitest';
import { vomeroDetail } from '@/lib/sourcing-map/__fixtures__/vomero';
import type { SmExecutionDetail2, SmCandidateResult2, SmOptionLimit2 } from '@/lib/sourcing-map/types';

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
