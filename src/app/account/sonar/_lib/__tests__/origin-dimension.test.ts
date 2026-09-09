import { describe, it, expect } from 'vitest';
import type { AuditRunResult, GeoRollupEntry } from '@haiwave/protocol';
import { DIMENSIONS, DIMENSION_LABEL, rollupFor, resolvedCountriesOf, countryName } from '../origin-dimension';

const entry = (country_of_origin: string, component_count: number): GeoRollupEntry => ({ country_of_origin, component_count, depth_distribution: {} });
// The helpers read only the three rollup fields; cast the rest away (the house fixture style).
const result = (r: Partial<AuditRunResult>): AuditRunResult => ({ geo_rollup: [], ...r } as unknown as AuditRunResult);

// D-219 (2026-09-08): one definition of "which rollup" and "which countries" for every audit surface.
describe('origin-dimension', () => {
  it('lists the three dimensions, manufacturing first, with sentence-case labels', () => {
    expect(DIMENSIONS).toEqual(['manufacturing', 'design', 'firmware']);
    expect(DIMENSION_LABEL).toEqual({ manufacturing: 'Manufacturing', design: 'Design', firmware: 'Firmware' });
  });
  it('rollupFor reads the matching field and is [] for a dimension an older haiCore did not send', () => {
    const r = result({ geo_rollup: [entry('TW', 3)], design_geo_rollup: [entry('CN', 2)] });
    expect(rollupFor(r, 'manufacturing')).toEqual([entry('TW', 3)]);
    expect(rollupFor(r, 'design')).toEqual([entry('CN', 2)]);
    expect(rollupFor(r, 'firmware')).toEqual([]);
  });
  it('resolvedCountriesOf: distinct, most components first, sentinels dropped', () => {
    expect(resolvedCountriesOf([entry('<unknown>', 9), entry('US', 1), entry('CN', 4), entry('XX', 2), entry('CN', 1)])).toEqual(['CN', 'US']);
    expect(resolvedCountriesOf([entry('<unknown>', 1)])).toEqual([]);
    expect(resolvedCountriesOf([])).toEqual([]);
  });
  it('countryName names a known code and falls back to the code', () => {
    expect(countryName('CN')).toBe('China');
    expect(countryName('TW')).toBe('Taiwan');
    expect(countryName('ZZ')).toBe('ZZ');
    expect(countryName('<unknown>')).toBe('<unknown>');
  });
});
