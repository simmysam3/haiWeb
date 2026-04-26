import { describe, it, expect } from 'vitest';
import type { AuditRun, AuditRunResult, AuditTraversalNode, GeoRollupEntry } from '@haiwave/protocol';
import { buildPartnerCompliance } from '../partner-compliance';

const VENDOR_A = '11111111-1111-1111-1111-111111111111';
const VENDOR_B = '22222222-2222-2222-2222-222222222222';
const VENDOR_C = '33333333-3333-3333-3333-333333333333';
const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUDITOR_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeRun(vendorIds: string[]): AuditRun {
  return {
    run_id: RUN_ID,
    auditor_participant_id: AUDITOR_ID,
    triggered_at: '2026-04-26T00:00:00.000Z',
    triggered_by_user_id: null,
    scope_snapshot: {
      scope_ids: [],
      resolved_products: vendorIds.map((vendor_id, i) => ({
        vendor_id,
        product_id: `prod-${i}`,
      })),
    },
    status: 'complete',
    completed_at: '2026-04-26T00:01:00.000Z',
    depth_limit: 5,
    hop_count: 1,
    gap_count: 0,
    error_message: null,
  };
}

function makeRollup(entries: Array<[string, number]>): GeoRollupEntry[] {
  return entries.map(([country_of_origin, component_count]) => ({
    country_of_origin,
    component_count,
    depth_distribution: {},
  }));
}

function makeTree(vendorLegalName: string | null): AuditTraversalNode {
  return {
    participant_id: null,
    vendor_legal_name: vendorLegalName,
    product_id: null,
    component_ref: null,
    internally_manufactured: true,
    origin: {
      country_of_origin: 'US',
      state_province: null,
      city: null,
      plant_address: null,
      plant_identifier: null,
      vendor_name: null,
    },
    operational_status: {
      lead_time_meets: null,
      capacity: null,
      delivery_state: null,
    },
    depth_level: 0,
    components: [],
    gap: null,
  };
}

function makeResult(args: {
  vendor_participant_id: string;
  product_id?: string;
  vendor_legal_name: string | null;
  rollup: GeoRollupEntry[];
}): AuditRunResult {
  return {
    result_id: `${args.vendor_participant_id}-${args.product_id ?? 'p'}`,
    run_id: RUN_ID,
    vendor_participant_id: args.vendor_participant_id,
    product_id: args.product_id ?? 'prod-x',
    tree: makeTree(args.vendor_legal_name),
    geo_rollup: args.rollup,
  };
}

describe('buildPartnerCompliance', () => {
  it('returns empty data shape for an empty run', () => {
    const run = makeRun([]);
    const data = buildPartnerCompliance(run, []);
    expect(data).toEqual({
      rows: [],
      total_vendors_in_scope: 0,
      total_non_compliant: 0,
      median_per_vendor: 0,
    });
  });

  it('counts non-US components and excludes US (unknown counts as non-compliant)', () => {
    const run = makeRun([VENDOR_A]);
    const result = makeResult({
      vendor_participant_id: VENDOR_A,
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([
        ['US', 10],
        ['CN', 4],
        ['DE', 2],
        ['<unknown>', 3],
      ]),
    });
    const data = buildPartnerCompliance(run, [result]);
    expect(data.rows).toEqual([
      {
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'Acme Corp.',
        non_compliant_count: 9,
      },
    ]);
    expect(data.total_non_compliant).toBe(9);
  });

  it('sums non-compliant counts when one vendor has multiple results', () => {
    const run = makeRun([VENDOR_A]);
    const r1 = makeResult({
      vendor_participant_id: VENDOR_A,
      product_id: 'prod-1',
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([['CN', 5], ['US', 2]]),
    });
    const r2 = makeResult({
      vendor_participant_id: VENDOR_A,
      product_id: 'prod-2',
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([['DE', 3], ['<unknown>', 1]]),
    });
    const data = buildPartnerCompliance(run, [r1, r2]);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({
      vendor_participant_id: VENDOR_A,
      non_compliant_count: 9, // 5 + 3 + 1
    });
  });

  it('total_vendors_in_scope counts distinct vendors from scope_snapshot, not from results', () => {
    const run = makeRun([VENDOR_A, VENDOR_B, VENDOR_C, VENDOR_C]); // duplicate vendor in scope (different products)
    const result = makeResult({
      vendor_participant_id: VENDOR_A,
      vendor_legal_name: 'Acme Corp.',
      rollup: makeRollup([['CN', 1]]),
    });
    const data = buildPartnerCompliance(run, [result]);
    expect(data.total_vendors_in_scope).toBe(3); // A, B, C — duplicates collapse
  });

  it('median (odd in-scope count) is the middle value across all in-scope vendors, zeros included', () => {
    const run = makeRun([VENDOR_A, VENDOR_B, VENDOR_C]);
    // A: 10 non-compliant, B: 4 non-compliant, C: no result -> 0
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'A',
        rollup: makeRollup([['CN', 10]]),
      }),
      makeResult({
        vendor_participant_id: VENDOR_B,
        vendor_legal_name: 'B',
        rollup: makeRollup([['DE', 4]]),
      }),
    ]);
    // Sorted [0, 4, 10] -> median 4
    expect(data.median_per_vendor).toBe(4);
  });

  it('median (even in-scope count) is the average of the two middle values', () => {
    const run = makeRun([VENDOR_A, VENDOR_B, VENDOR_C, '44444444-4444-4444-4444-444444444444']);
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'A',
        rollup: makeRollup([['CN', 8]]),
      }),
      makeResult({
        vendor_participant_id: VENDOR_B,
        vendor_legal_name: 'B',
        rollup: makeRollup([['DE', 4]]),
      }),
      // C, D: no results -> 0, 0
    ]);
    // Sorted [0, 0, 4, 8] -> median (0 + 4) / 2 = 2
    expect(data.median_per_vendor).toBe(2);
  });

  it('vendors in scope without a result are excluded from rows but contribute 0 to the median set', () => {
    const run = makeRun([VENDOR_A, VENDOR_B]);
    const data = buildPartnerCompliance(run, [
      makeResult({
        vendor_participant_id: VENDOR_A,
        vendor_legal_name: 'A',
        rollup: makeRollup([['CN', 6]]),
      }),
    ]);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0].vendor_participant_id).toBe(VENDOR_A);
    // Sorted [0, 6] -> median (0 + 6) / 2 = 3
    expect(data.median_per_vendor).toBe(3);
  });
});
