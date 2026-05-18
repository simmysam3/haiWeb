import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: any) => async (req: NextRequest, ctx: any) => {
    const client = (globalThis as any).__mockClient;
    const params = await ctx.params;
    return await handler({ client, request: req, params, session: {} });
  },
}));

import { GET } from '../route';

function makeReq(id: string) {
  return new NextRequest(`http://localhost:3001/api/account/sonar/templates/${id}/runs`);
}

describe('GET /api/account/sonar/templates/[id]/runs', () => {
  beforeEach(() => {
    (globalThis as any).__mockClient = {
      getRunTemplate: vi.fn(),
      listAuditRuns: vi.fn(),
      listWatcherRuns: vi.fn(),
      listPhantomDemandRuns: vi.fn(),
    };
  });

  it('audit template: dispatches to listAuditRuns with template_id', async () => {
    (globalThis as any).__mockClient.getRunTemplate.mockResolvedValue({
      template: { template_id: 'tA', observation_class: 'audit', enabled: true },
    });
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({
      runs: [
        { run_id: 'r1', status: 'complete', triggered_at: '2026-05-09T01:00:00Z', completed_at: '2026-05-09T01:01:00Z', run_origin: 'template_manual', template_id: 'tA' },
      ],
    });
    const res = await GET(makeReq('tA'), { params: Promise.resolve({ id: 'tA' }) });
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect((globalThis as any).__mockClient.listAuditRuns).toHaveBeenCalledWith({
      template_id: 'tA',
      limit: 200,
    });
  });

  it('watcher template: dispatches to listWatcherRuns', async () => {
    (globalThis as any).__mockClient.getRunTemplate.mockResolvedValue({
      template: { template_id: 'tB', observation_class: 'watcher', enabled: true },
    });
    (globalThis as any).__mockClient.listWatcherRuns.mockResolvedValue({
      runs: [{ run_id: 't1', status: 'complete', triggered_at: '2026-05-09T02:00:00Z', completed_at: null, run_origin: 'template_scheduled', template_id: 'tB' }],
    });
    const res = await GET(makeReq('tB'), { params: Promise.resolve({ id: 'tB' }) });
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect((globalThis as any).__mockClient.listWatcherRuns).toHaveBeenCalledWith({
      template_id: 'tB',
      limit: 200,
    });
    expect((globalThis as any).__mockClient.listAuditRuns).not.toHaveBeenCalled();
  });

  it('phantom_demand template: dispatches to listPhantomDemandRuns (bare array; created_at → triggered_at)', async () => {
    (globalThis as any).__mockClient.getRunTemplate.mockResolvedValue({
      template: { template_id: 'tP', observation_class: 'phantom_demand', enabled: true },
    });
    (globalThis as any).__mockClient.listPhantomDemandRuns.mockResolvedValue([
      { run_id: 'p1', status: 'complete', created_at: '2026-05-18T04:28:12Z', completed_at: '2026-05-18T04:28:13Z', run_origin: 'template_manual', template_id: 'tP' },
    ]);
    const res = await GET(makeReq('tP'), { params: Promise.resolve({ id: 'tP' }) });
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toEqual({
      run_id: 'p1',
      status: 'complete',
      triggered_at: '2026-05-18T04:28:12Z',
      completed_at: '2026-05-18T04:28:13Z',
      run_origin: 'template_manual',
    });
    expect((globalThis as any).__mockClient.listPhantomDemandRuns).toHaveBeenCalledWith({
      template_id: 'tP',
      limit: 200,
    });
    expect((globalThis as any).__mockClient.listAuditRuns).not.toHaveBeenCalled();
    expect((globalThis as any).__mockClient.listWatcherRuns).not.toHaveBeenCalled();
  });

  it('returns slice limited to 25 most-recent runs', async () => {
    (globalThis as any).__mockClient.getRunTemplate.mockResolvedValue({
      template: { template_id: 'tA', observation_class: 'audit', enabled: true },
    });
    const manyRuns = Array.from({ length: 60 }, (_, i) => ({
      run_id: `r${i}`,
      status: 'complete',
      triggered_at: `2026-05-09T${String(i % 24).padStart(2, '0')}:00:00Z`,
      completed_at: null,
      run_origin: 'template_scheduled',
      template_id: 'tA',
    }));
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({ runs: manyRuns });
    const res = await GET(makeReq('tA'), { params: Promise.resolve({ id: 'tA' }) });
    const body = await res.json();
    expect(body.runs).toHaveLength(25);
  });
});
