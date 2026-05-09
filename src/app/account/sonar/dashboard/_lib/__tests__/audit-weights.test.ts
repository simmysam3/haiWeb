import { describe, it, expect } from 'vitest';
import type { AuditRun, AuditRunResult } from '@haiwave/protocol';
import { buildPerPartnerAuditWeights } from '../audit-weights';

const VENDOR_A = '00000000-0000-0000-0000-00000000000a';
const VENDOR_B = '00000000-0000-0000-0000-00000000000b';

function mkRun(productVendorIds: string[]): AuditRun {
  return {
    run_id: 'r1',
    auditor_participant_id: 'caller',
    triggered_at: '2026-05-09T00:00:00Z',
    completed_at: '2026-05-09T00:01:00Z',
    status: 'complete',
    scope_snapshot: {
      resolved_products: productVendorIds.map((vid, i) => ({
        product_id: `p${i}`,
        vendor_id: vid,
      })),
    } as unknown as AuditRun['scope_snapshot'],
    gap_count: 0,
  } as unknown as AuditRun;
}

function mkResult(vendorId: string, vendorName: string | null, geoRollup: Array<{ country: string; count: number }>): AuditRunResult {
  return {
    vendor_participant_id: vendorId,
    tree: { vendor_legal_name: vendorName } as unknown as AuditRunResult['tree'],
    geo_rollup: geoRollup.map((g) => ({
      country_of_origin: g.country,
      component_count: g.count,
      depth_distribution: {},
    })),
  } as unknown as AuditRunResult;
}

describe('buildPerPartnerAuditWeights', () => {
  it('vendor with all-US components: weight = 0', () => {
    const run = mkRun([VENDOR_A, VENDOR_A]);
    const results = [mkResult(VENDOR_A, 'A Co', [{ country: 'US', count: 10 }])];
    const out = buildPerPartnerAuditWeights(run, results);
    expect(out.get(VENDOR_A)).toEqual({
      vendor_id: VENDOR_A,
      vendor_name: 'A Co',
      non_compliant_count: 0,
      total_component_count: 10,
      weight: 0,
    });
  });

  it('vendor with all-foreign components: weight = 1', () => {
    const run = mkRun([VENDOR_A]);
    const results = [mkResult(VENDOR_A, 'A Co', [{ country: 'CN', count: 7 }])];
    const out = buildPerPartnerAuditWeights(run, results);
    expect(out.get(VENDOR_A)?.weight).toBe(1);
    expect(out.get(VENDOR_A)?.non_compliant_count).toBe(7);
    expect(out.get(VENDOR_A)?.total_component_count).toBe(7);
  });

  it('vendor with mixed origin: weight = non_compliant / total', () => {
    const run = mkRun([VENDOR_A]);
    const results = [
      mkResult(VENDOR_A, 'A Co', [
        { country: 'US', count: 7 },
        { country: 'CN', count: 3 },
      ]),
    ];
    const out = buildPerPartnerAuditWeights(run, results);
    expect(out.get(VENDOR_A)?.weight).toBeCloseTo(0.3, 5);
  });

  it('vendor in scope but no result rows: weight = 0 (present-and-empty)', () => {
    const run = mkRun([VENDOR_A]);
    const results: AuditRunResult[] = [];
    const out = buildPerPartnerAuditWeights(run, results);
    expect(out.get(VENDOR_A)).toEqual({
      vendor_id: VENDOR_A,
      vendor_name: null,
      non_compliant_count: 0,
      total_component_count: 0,
      weight: 0,
    });
  });

  it('multiple vendors: each gets its own row', () => {
    const run = mkRun([VENDOR_A, VENDOR_B]);
    const results = [
      mkResult(VENDOR_A, 'A Co', [{ country: 'CN', count: 4 }]),
      mkResult(VENDOR_B, 'B Co', [{ country: 'US', count: 6 }]),
    ];
    const out = buildPerPartnerAuditWeights(run, results);
    expect(out.size).toBe(2);
    expect(out.get(VENDOR_A)?.weight).toBe(1);
    expect(out.get(VENDOR_B)?.weight).toBe(0);
  });

  it('coalesces multiple result rows for the same vendor', () => {
    const run = mkRun([VENDOR_A]);
    const results = [
      mkResult(VENDOR_A, 'A Co', [{ country: 'US', count: 5 }]),
      mkResult(VENDOR_A, null, [{ country: 'CN', count: 5 }]),
    ];
    const out = buildPerPartnerAuditWeights(run, results);
    const row = out.get(VENDOR_A);
    expect(row?.total_component_count).toBe(10);
    expect(row?.non_compliant_count).toBe(5);
    expect(row?.weight).toBeCloseTo(0.5, 5);
    expect(row?.vendor_name).toBe('A Co');
  });
});
