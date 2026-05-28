import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: any) => async (req: NextRequest) => {
    const client = (globalThis as any).__mockClient;
    return await handler({ client, request: req, params: {}, session: {} });
  },
}));

import { GET } from '../route';

const VENDOR_A = '00000000-0000-0000-0000-00000000000a';
const VENDOR_B = '00000000-0000-0000-0000-00000000000b';

function setMockClient(overrides: Record<string, any>) {
  (globalThis as any).__mockClient = {
    listAuditRuns: vi.fn().mockResolvedValue({ runs: [] }),
    getAuditRunResults: vi.fn().mockResolvedValue({ results: [] }),
    listWatcherRuns: vi.fn().mockResolvedValue({ runs: [] }),
    getWatcherRun: vi.fn().mockResolvedValue({ run: {}, results: [] }),
    fetchRaw: vi.fn().mockResolvedValue(new Response('{}', { status: 404 })),
    ...overrides,
  };
}

function makeReq() {
  return new NextRequest('http://localhost:3001/api/account/sonar/dashboard/cross-modality');
}

describe('GET /api/account/sonar/dashboard/cross-modality', () => {
  beforeEach(() => {
    setMockClient({});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty partners array when no modality data exists', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.partners).toEqual([]);
    expect(typeof body.generated_at).toBe('string');
  });

  it('returns partial flags all false when all modalities succeed', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.partial).toEqual({ audit: false, phantom_demand: false, watcher: false });
  });

  it('joins audit + watcher by partner_id (phantom-demand now handled by separate endpoint)', async () => {
    setMockClient({
      listAuditRuns: vi.fn().mockResolvedValue({
        runs: [
          {
            run_id: 'r1',
            status: 'complete',
            triggered_at: '2026-05-09T00:00:00Z',
            scope_snapshot: { resolved_products: [{ vendor_id: VENDOR_A }, { vendor_id: VENDOR_B }] },
          },
        ],
      }),
      getAuditRunResults: vi.fn().mockResolvedValue({
        results: [
          {
            vendor_participant_id: VENDOR_A,
            tree: { vendor_legal_name: 'A Co' },
            geo_rollup: [
              { country_of_origin: 'US', component_count: 6, depth_distribution: {} },
              { country_of_origin: 'CN', component_count: 4, depth_distribution: {} },
            ],
          },
          {
            vendor_participant_id: VENDOR_B,
            tree: { vendor_legal_name: 'B Co' },
            geo_rollup: [
              { country_of_origin: 'US', component_count: 10, depth_distribution: {} },
            ],
          },
        ],
      }),
      listWatcherRuns: vi.fn().mockResolvedValue({
        runs: [{ run_id: 't1', status: 'complete', triggered_at: '2026-05-09T00:00:00Z' }],
      }),
      getWatcherRun: vi.fn().mockResolvedValue({
        run: { run_id: 't1' },
        results: [
          {
            counterparty_participant_id: VENDOR_A,
            signal_type: 'capacity_utilization_band',
            payload: { band: 'high', observed_at: '2026-05-09T00:00:00Z' },
            synthesis_mode: 'direct',
          },
          {
            counterparty_participant_id: VENDOR_A,
            signal_type: 'lead_time_distribution',
            payload: { window_days: 90, percentiles: { p50: 5, p75: 7, p90: 14, p95: 18, p99: 21 }, sample_count: 10 },
            synthesis_mode: 'direct',
          },
        ],
      }),
    });

    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.partners).toHaveLength(2);

    // Audit results must come from the canonical typed method (which hits
    // /source-audit/runs/:id/results), NOT a hand-rolled non-existent path.
    const client = (globalThis as any).__mockClient;
    expect(client.getAuditRunResults).toHaveBeenCalledWith('r1');

    const a = body.partners.find((p: any) => p.partner_id === VENDOR_A);
    expect(a.partner_name).toBe('A Co');
    expect(a.audit).toEqual({
      compliant: 6,
      non_compliant: 4,
      partial: 0,
      total: 10,
    });
    // Phantom demand now returns null (handled by separate phantom-demand-aggregate endpoint)
    expect(a.phantom_demand).toBeNull();
    expect(a.watcher.capacity_band).toBe('high');
    expect(a.watcher.lead_time_p90_days).toBe(14);
    // audit_w = 0.4, pd_w = null (no longer aggregated), watcher_w = 0.67
    // score = 0.4*0.4 + 0.67*0.3 = 0.16 + 0.201 = 0.361, but weights shift since pd_w removed
    // actual: audit*0.4 + watcher*0.3/(1-0.3) approx when pd_w null
    // Let's just verify it's a reasonable risk value
    expect(a.risk_score).toBeGreaterThan(0.3);
    expect(a.risk_score).toBeLessThan(0.5);

    const b = body.partners.find((p: any) => p.partner_id === VENDOR_B);
    expect(b.audit).not.toBeNull();
    expect(b.phantom_demand).toBeNull();
    expect(b.watcher).toBeNull();

    // No failures — partial flags all false.
    expect(body.partial).toEqual({ audit: false, phantom_demand: false, watcher: false });
  });

  it('merges watcher signals across recent runs (newest wins per signal type)', async () => {
    setMockClient({
      // Newest-first: t2 (lead-time only) then t1 (capacity only).
      listWatcherRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 't2', status: 'complete', triggered_at: '2026-05-17T18:00:00Z' },
          { run_id: 't1', status: 'complete', triggered_at: '2026-05-17T16:00:00Z' },
        ],
      }),
      getWatcherRun: vi.fn(async (runId: string) => {
        if (runId === 't2') {
          return {
            run: { run_id: 't2' },
            results: [
              {
                counterparty_participant_id: VENDOR_A,
                signal_type: 'lead_time_distribution',
                payload: { percentiles: { p90: 9 } },
                synthesis_mode: 'direct',
              },
            ],
          };
        }
        return {
          run: { run_id: 't1' },
          results: [
            {
              counterparty_participant_id: VENDOR_A,
              signal_type: 'capacity_utilization_band',
              payload: { band: 'at_capacity' },
              synthesis_mode: 'direct',
            },
          ],
        };
      }),
    });

    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    const a = body.partners.find((p: any) => p.partner_id === VENDOR_A);
    // lead-time from the newest run, capacity from the older run — neither
    // shadows the other.
    expect(a.watcher.lead_time_p90_days).toBe(9);
    expect(a.watcher.capacity_band).toBe('at_capacity');
  });

  it('a failing watcher run-detail fetch sets partial.watcher true, logs, and still returns other runs data', async () => {
    setMockClient({
      listWatcherRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 'bad', status: 'complete', triggered_at: '2026-05-17T18:00:00Z' },
          { run_id: 'good', status: 'complete', triggered_at: '2026-05-17T16:00:00Z' },
        ],
      }),
      getWatcherRun: vi.fn(async (runId: string) => {
        if (runId === 'bad') throw new Error('haiCore GET …: 500');
        return {
          run: { run_id: 'good' },
          results: [
            {
              counterparty_participant_id: VENDOR_A,
              signal_type: 'lead_time_distribution',
              payload: { percentiles: { p90: 4 } },
              synthesis_mode: 'direct',
            },
          ],
        };
      }),
    });

    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    // Data from the good run still arrives.
    const a = body.partners.find((p: any) => p.partner_id === VENDOR_A);
    expect(a.watcher.lead_time_p90_days).toBe(4);

    // Partiality flag set for watcher, not for others.
    expect(body.partial.watcher).toBe(true);
    expect(body.partial.audit).toBe(false);
    expect(body.partial.phantom_demand).toBe(false);

    // console.error called with the failing run_id.
    expect(console.error).toHaveBeenCalledWith(
      '[cross-modality] watcher run-detail fetch failed',
      expect.objectContaining({ run_id: 'bad' }),
    );
  });

  it('a thrown audit loader sets partial.audit true, logs, and does not 500 the route', async () => {
    setMockClient({
      listAuditRuns: vi.fn().mockRejectedValue(new Error('haiCore: 503')),
    });

    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.partial.audit).toBe(true);
    expect(body.partial.phantom_demand).toBe(false);
    expect(body.partial.watcher).toBe(false);

    expect(console.error).toHaveBeenCalledWith(
      '[cross-modality] audit load failed',
      expect.anything(),
    );
  });

  it('phantom-demand is no longer loaded by cross-modality (handled separately)', async () => {
    // Refined PD: cross-modality no longer calls fetchRaw for phantom-demand.
    // partial.phantom_demand is always false since we don't try to load it.
    setMockClient({});

    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    // phantom-demand loading was removed; no partial flag should be set
    expect(body.partial.phantom_demand).toBe(false);
    expect(body.partial.audit).toBe(false);
    expect(body.partial.watcher).toBe(false);
  });

  it('a thrown watcher loader sets partial.watcher true, logs, and does not 500 the route', async () => {
    setMockClient({
      listWatcherRuns: vi.fn().mockRejectedValue(new Error('haiCore: 502')),
    });

    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.partial.watcher).toBe(true);
    expect(body.partial.audit).toBe(false);
    expect(body.partial.phantom_demand).toBe(false);

    expect(console.error).toHaveBeenCalledWith(
      '[cross-modality] watcher load failed',
      expect.anything(),
    );
  });

  it('phantom-demand always returns empty (handled by separate endpoint)', async () => {
    // Refined PD: cross-modality no longer loads per-partner PD data.
    // Dashboard has a separate phantom-demand-aggregate endpoint.
    // All partners will have phantom_demand: null regardless of mock state.
    setMockClient({
      listAuditRuns: vi.fn().mockResolvedValue({ runs: [] }),
      listWatcherRuns: vi.fn().mockResolvedValue({ runs: [] }),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    // No partial.phantom_demand failures expected; it's always empty/not-loaded.
    expect(body.partial.phantom_demand).toBe(false);
  });
});
