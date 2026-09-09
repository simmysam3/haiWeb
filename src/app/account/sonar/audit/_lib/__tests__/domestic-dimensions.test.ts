import { describe, it, expect } from 'vitest';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import { countDomesticByDimension } from '../domestic';

const entry = (country_of_origin: string, component_count = 1): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
const result = (r: Partial<AuditRunResult>): AuditRunResult => ({ geo_rollup: [], ...r } as unknown as AuditRunResult);

// D-219 (2026-09-08): the run's per-dimension "fully domestic" counts, derived from its own results (spec R2).
describe('countDomesticByDimension', () => {
  const results = [
    result({ geo_rollup: [entry('US', 3)], design_geo_rollup: [entry('US')], firmware_geo_rollup: [entry('US')] }),          // domestic in all three
    result({ geo_rollup: [entry('US', 2)], design_geo_rollup: [entry('CN')], firmware_geo_rollup: [entry('<unknown>')] }),   // manufacturing only
    result({ geo_rollup: [entry('TW')], design_geo_rollup: [entry('US')] }),                                                 // design only; firmware undeclared
  ];
  it('counts each dimension with the per-SKU definition and reports the total', () => {
    expect(countDomesticByDimension(results, 'US')).toEqual({ manufacturing: 2, design: 2, firmware: 1, total: 3 });
  });
  it('undeclared or unresolved never counts as domestic', () => {
    expect(countDomesticByDimension([results[1], results[2]], 'US').firmware).toBe(0);
  });
  it('no auditor country: zero everywhere, total still the row count', () => {
    expect(countDomesticByDimension(results, undefined)).toEqual({ manufacturing: 0, design: 0, firmware: 0, total: 3 });
  });
  it('no results: all zero', () => {
    expect(countDomesticByDimension([], 'US')).toEqual({ manufacturing: 0, design: 0, firmware: 0, total: 0 });
  });
});
