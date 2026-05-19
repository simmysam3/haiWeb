import { describe, it, expect, vi, afterEach } from 'vitest';
import type { AuditRun, AuditRunResult, ObservationNode } from '@haiwave/protocol';
import { loadAuditChartData } from '../load-audit-charts';

const BASE = 'http://test.local';
const COOKIE = 'session=abc';
const RUN_ID = '11111111-1111-1111-1111-111111111111';
const VENDOR_ID = '22222222-2222-2222-2222-222222222222';

function makeTree(): ObservationNode {
  return {
    participant_id: VENDOR_ID,
    vendor_legal_name: 'Acme Co',
    payload: {
      kind: 'audit',
      product_id: null,
      disclosure_data: null,
      class_ids: [],
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
    },
    depth_level: 0,
    components: [],
    gap: null,
    synthesis_mode: 'direct',
    identity_redacted: false,
  };
}

function makeRun(overrides: Partial<AuditRun> = {}): AuditRun {
  return {
    run_id: RUN_ID,
    initiator_participant_id: '33333333-3333-3333-3333-333333333333',
    triggered_at: '2026-05-10T12:00:00.000Z',
    triggered_by_user_id: null,
    scope_snapshot: {
      scope_ids: [],
      resolved_products: [{ vendor_id: VENDOR_ID, product_id: 'p-1' }],
    },
    status: 'complete',
    completed_at: '2026-05-10T12:30:00.000Z',
    cancelled_at: null,
    depth_limit: 3,
    hop_count: 1,
    gap_count: 7,
    error_message: null,
    ...overrides,
  };
}

function makeResult(
  overrides: Partial<AuditRunResult> = {},
): AuditRunResult {
  return {
    result_id: '44444444-4444-4444-4444-444444444444',
    run_id: RUN_ID,
    vendor_participant_id: VENDOR_ID,
    product_id: 'p-1',
    tree: makeTree(),
    geo_rollup: [],
    ...overrides,
  };
}

/** Route the global fetch mock by URL pathname. */
function stubFetch(routes: Record<string, { ok: boolean; body?: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      const path = url.slice(BASE.length);
      const match = routes[path];
      if (!match) {
        throw new Error(`unexpected fetch: ${path}`);
      }
      return {
        ok: match.ok,
        json: async () => match.body ?? {},
      } as Response;
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('loadAuditChartData', () => {
  it('accumulates same-country geo_rollup, merges depth keys, sorts by component_count DESC', async () => {
    const resultA = makeResult({
      result_id: '44444444-0000-0000-0000-000000000001',
      geo_rollup: [
        { country_of_origin: 'CN', component_count: 3, depth_distribution: { '1': 3 } },
        { country_of_origin: 'US', component_count: 1, depth_distribution: { '0': 1 } },
      ],
    });
    const resultB = makeResult({
      result_id: '44444444-0000-0000-0000-000000000002',
      geo_rollup: [
        { country_of_origin: 'CN', component_count: 5, depth_distribution: { '2': 4, '1': 1 } },
      ],
    });

    stubFetch({
      '/api/account/audit-runs?limit=25': { ok: true, body: { runs: [makeRun()] } },
      [`/api/account/audit-runs/${RUN_ID}/results`]: {
        ok: true,
        body: { results: [resultA, resultB] },
      },
      [`/api/account/audit-runs/${RUN_ID}/class-rollup`]: {
        ok: true,
        body: { rollup: [] },
      },
    });

    const out = await loadAuditChartData(BASE, COOKIE);

    // CN accumulated 3 + 5 = 8 (now first), US = 1 (second).
    expect(out.rollup.map((e) => e.country_of_origin)).toEqual(['CN', 'US']);
    const cn = out.rollup.find((e) => e.country_of_origin === 'CN')!;
    expect(cn.component_count).toBe(8);
    // depth keys merged across both CN entries.
    expect(cn.depth_distribution).toEqual({ '1': 4, '2': 4 });
    const us = out.rollup.find((e) => e.country_of_origin === 'US')!;
    expect(us.component_count).toBe(1);
    expect(out.gaps).toBe(7);
    expect(out.latestAt).toBe('2026-05-10T12:00:00.000Z');
    expect(out.partnerCompliance).not.toBeNull();
  });

  it('returns EMPTY when the runs fetch is not ok (500)', async () => {
    stubFetch({
      '/api/account/audit-runs?limit=25': { ok: false },
    });

    const out = await loadAuditChartData(BASE, COOKIE);

    expect(out).toEqual({
      rollup: [],
      classRollup: [],
      gaps: null,
      latestAt: null,
      partnerCompliance: null,
    });
  });

  it('returns EMPTY when no run has status complete or partial', async () => {
    stubFetch({
      '/api/account/audit-runs?limit=25': {
        ok: true,
        body: {
          runs: [
            makeRun({ status: 'running' }),
            makeRun({ status: 'failed' }),
            makeRun({ status: 'cancelled' }),
          ],
        },
      },
    });

    const out = await loadAuditChartData(BASE, COOKIE);

    expect(out).toEqual({
      rollup: [],
      classRollup: [],
      gaps: null,
      latestAt: null,
      partnerCompliance: null,
    });
  });

  it('uses the first complete/partial run for gaps (gap_count ?? 0) and latestAt', async () => {
    stubFetch({
      '/api/account/audit-runs?limit=25': {
        ok: true,
        body: {
          runs: [
            makeRun({
              status: 'complete',
              gap_count: null,
              triggered_at: '2026-05-12T09:00:00.000Z',
            }),
          ],
        },
      },
      [`/api/account/audit-runs/${RUN_ID}/results`]: {
        ok: true,
        body: { results: [makeResult()] },
      },
      [`/api/account/audit-runs/${RUN_ID}/class-rollup`]: {
        ok: true,
        body: { rollup: [] },
      },
    });

    const out = await loadAuditChartData(BASE, COOKIE);

    // gap_count null → coalesced to 0.
    expect(out.gaps).toBe(0);
    expect(out.latestAt).toBe('2026-05-12T09:00:00.000Z');
  });
});
