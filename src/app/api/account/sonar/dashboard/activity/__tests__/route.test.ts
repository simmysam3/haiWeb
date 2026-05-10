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
    fetchRaw: vi.fn().mockResolvedValue(new Response('{}', { status: 404 })),
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
          { run_id: 't1', status: 'complete', triggered_at: '2026-05-09T02:00:00Z', completed_at: '2026-05-09T02:05:00Z', run_origin: 'template_manual' },
        ],
      }),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events.map((e: any) => e.run_id)).toEqual(['a1', 't1', 'a2']);
    expect(body.events[0].modality).toBe('audit');
    expect(body.events[0].detail_href).toBe('/account/sonar/audit/runs/a1');
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

  it('includes the latest phantom-demand window as a single event when available', async () => {
    setMockClient({
      fetchRaw: vi.fn(async (path: string) => {
        if (path === '/sonar/phantom-demand/reports/latest') {
          return new Response(JSON.stringify({ window_id: 'w1' }), { status: 200 });
        }
        if (path === '/sonar/phantom-demand/reports/w1/aggregate') {
          return new Response(
            JSON.stringify({ header: { window_id: 'w1', generated_at: '2026-05-09T04:00:00Z' } }),
            { status: 200 },
          );
        }
        return new Response('{}', { status: 404 });
      }),
    });
    const res = await GET(makeReq(), { params: Promise.resolve({}) });
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      modality: 'phantom_demand',
      run_id: 'w1',
      detail_href: '/account/sonar/phantom-demand/reports/w1',
    });
  });
});
