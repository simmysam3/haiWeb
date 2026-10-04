import { describe, it, expect } from 'vitest';
import { SmExecutionDetailSchema } from '@haiwave/protocol';
import type { SmCandidateResult2, SmExecutionDetail2 } from '@/lib/sourcing-map/types';
import { multitierDetail } from '../../sp2';
import { compareDetail } from '..';

const optionsOf = (d: SmExecutionDetail2): SmCandidateResult2[] => d.result!.slots.flatMap((s) => s.candidates);
const option = (d: SmExecutionDetail2, key: string): SmCandidateResult2 => optionsOf(d).find((c) => c.candidate_key === key)!;
const bindingAliases = (c: SmCandidateResult2): string[] => (c.trace?.nodes ?? []).filter((n) => n.role === 'binding').map((n) => n.alias);
const tierUnder = (d: SmExecutionDetail2, key: string, alias: string): number | undefined => option(d, key).nodes?.find((n) => n.alias === alias)?.tier;

describe('the compare fixture (LF §9.2)', () => {
  it('compare: parses under the protocol and tells its story consistently', () => {
    expect(() => SmExecutionDetailSchema.parse(compareDetail)).not.toThrow();
    expect(bindingAliases(option(compareDetail, 'flowknit'))).toEqual(['D']);
    expect(bindingAliases(option(compareDetail, 'bowline'))).toEqual(['D']);

    // every binding node says how many options it binds for: the options whose trace binds that alias
    for (const c of optionsOf(compareDetail)) {
      for (const n of (c.trace?.nodes ?? []).filter((x) => x.role === 'binding')) {
        expect(n.binds_for).toBe(optionsOf(compareDetail).filter((o) => bindingAliases(o).includes(n.alias)).length);
      }
    }

    // shared exposure is what the nodes give: each alias under two or more options, at its shallowest tier
    const seen = new Map<string, Array<{ key: string; tier: number }>>();
    for (const c of optionsOf(compareDetail)) {
      for (const n of c.nodes ?? []) seen.set(n.alias, [...(seen.get(n.alias) ?? []), { key: c.candidate_key!, tier: n.tier }]);
    }
    const fromNodes = [...seen].filter(([, at]) => at.length >= 2).map(([alias, at]) => ({ alias, tier: Math.min(...at.map((x) => x.tier)), under: at.map((x) => x.key) }));
    expect(compareDetail.result!.shared_exposure).toEqual(fromNodes);

    // one alias, two tiers: C is tier 3 under León and tier 2 under Mekong
    expect([tierUnder(compareDetail, 'leon', 'C'), tierUnder(compareDetail, 'mekong', 'C')]).toEqual([3, 2]);

    // Mekong's nodes tally Dyes twice; its served class list is the server's and still names Wet-blue (OQ-5)
    const mekong = option(compareDetail, 'mekong');
    expect(mekong.nodes!.filter((n) => n.class?.label === 'Dyes')).toHaveLength(2);
    expect(mekong.aggregates!.classes).toContain('Wet-blue');

    // no name, id or quantity below tier 1 (the walk of sp2/__tests__/fixtures.test.ts)
    for (const c of optionsOf(compareDetail)) {
      for (const n of c.nodes ?? []) expect(Object.keys(n).sort()).toEqual(['alias', 'band', 'class', 'country', 'observed_below', 'tier']);
    }

    // the multitier is never touched: the deep copy leaves its own C at tier 3 under Mekong
    expect(tierUnder(multitierDetail, 'mekong', 'C')).toBe(3);
  });
});
