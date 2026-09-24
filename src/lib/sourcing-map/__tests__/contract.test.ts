import { describe, it, expect } from 'vitest';
import { SourcingMapScopeSchema, SM_LIMITS, mixTotalsHundred } from '../contract';

describe('sourcing-map contract mirror', () => {
  it('parses a saved draft run with no products and applies the scope defaults', () => {
    const parsed = SourcingMapScopeSchema.parse({
      kind: 'sourcing_map',
      project_id: '5a1e0000-0000-4000-8000-000000000001',
      products: [],
    });
    expect(parsed.depth_cap).toBe(SM_LIMITS.DEPTH_CAP_DEFAULT);
    expect(parsed.seat_weekly_capacity).toBeNull();
  });

  it('mixTotalsHundred compares integer hundredths: 99.99% passes and 99.98% fails (d-G7)', () => {
    expect(mixTotalsHundred({ '9': 33.33, '10': 33.33, '11': 33.33 })).toBe(true);
    expect(mixTotalsHundred({ '9': 33.33, '10': 33.33, '11': 33.32 })).toBe(false);
  });

  it('a slot key carries its size system, and the unclassified-slot prefix is exported (contract §10 b-G12)', async () => {
    const { SmSlotKeySchema, SM_UNCLASSIFIED_CLASS_PREFIX } = await import('../contract');
    expect(SM_UNCLASSIFIED_CLASS_PREFIX).toBe('unclassified:');
    expect(SmSlotKeySchema.safeParse({ class_id: 'cpt_rubber_outsoles', uom: 'pr', variant_bound: true, variant_system: "Men's US" }).success).toBe(true);
    expect(SmSlotKeySchema.safeParse({ class_id: 'cpt_flat_laces', uom: 'pr', variant_bound: false, variant_system: null }).success).toBe(true);
    expect(SmSlotKeySchema.safeParse({ class_id: 'cpt_flat_laces', uom: 'pr', variant_bound: false }).success).toBe(false);
  });
});
