import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: any) => async (req: NextRequest) => {
    const client = (globalThis as any).__mockClient;
    return await handler({ client, request: req, params: {}, session: {} });
  },
}));

import { GET } from '../route';

function setMockClient(overrides: Record<string, any>) {
  (globalThis as any).__mockClient = {
    listAuditRuns: vi.fn().mockResolvedValue({ runs: [] }),
    listWatcherRuns: vi.fn().mockResolvedValue({ runs: [] }),
    // v1.30 §7.7: PD activity sourced from listPhantomDemandRuns (not fetchRaw windows)
    listPhantomDemandRuns: vi.fn().mockResolvedValue([]),
    // commit 13754a1: route now fetches templates to enrich activity titles
    listRunTemplates: vi.fn().mockResolvedValue({ templates: [] }),
    ...overrides,
  };
}

function makeReq() {
  return new NextRequest('http://localhost:3001/api/account/sonar/dashboard/activity');
}

describe('GET /api/account/sonar/dashboard/activity', () => {
  beforeEach(() => setMockClient({}));

  it('returns empty events array when no runs exist', async () => {
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events).toEqual([]);
  });

  it('merges audit + watcher runs sorted by triggered_at desc', async () => {
    setMockClient({
      listAuditRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 'a1', status: 'complete', triggered_at: '2026-05-09T03:00:00Z', completed_at: '2026-05-09T03:01:00Z', run_origin: 'ad_hoc' },
          { run_id: 'a2', status: 'failed', triggered_at: '2026-05-09T01:00:00Z', completed_at: null, run_origin: 'template_scheduled' },
        ],
      }),
      listWatcherRuns: vi.fn().mockResolvedValue({
        runs: [
          { run_id: 't1', status: 'complete', triggered_at: '2026-05-09T02:00:00Z', completed_at: '2026-05-09T02:05:00Z', run_origin: 'template_manual', signal_types: ['price_change'], counterparty_filter: null, depth_limit: 1 },
        ],
      }),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events.map((e: any) => e.run_id)).toEqual(['a1', 't1', 'a2']);
    expect(body.events[0].modality).toBe('audit');
    expect(body.events[0].detail_href).toBe('/account/sonar/posture/runs/a1');
    expect(body.events[1].modality).toBe('watcher');
    expect(body.events[1].detail_href).toBe('/account/sonar/watcher/dashboard');
  });

  it('caps output at 30 events', async () => {
    const manyRuns = Array.from({ length: 50 }, (_, i) => ({
      run_id: `a${i}`,
      status: 'complete',
      triggered_at: `2026-05-09T${String(i % 24).padStart(2, '0')}:00:00Z`,
      completed_at: null,
      run_origin: 'ad_hoc',
    }));
    setMockClient({ listAuditRuns: vi.fn().mockResolvedValue({ runs: manyRuns }) });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events).toHaveLength(30);
  });

  it('includes phantom-demand runs as activity events (spec §7.7)', async () => {
    setMockClient({
      listPhantomDemandRuns: vi.fn().mockResolvedValue([
        {
          run_id: 'pd-1',
          status: 'complete',
          created_at: '2026-05-09T04:00:00Z',
          completed_at: '2026-05-09T04:05:00Z',
          run_origin: 'ad_hoc',
        },
      ]),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      modality: 'phantom_demand',
      run_id: 'pd-1',
      detail_href: '/account/sonar/phantom-demand/runs/pd-1',
    });
  });
});
