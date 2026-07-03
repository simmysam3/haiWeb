import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type MockHandlerCtx = { client: unknown; request: NextRequest; params?: unknown; session: unknown };

declare global {
  var __mockCountsClient: Record<string, ReturnType<typeof vi.fn>>;
}

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: MockHandlerCtx) => unknown) => async (req: NextRequest, _ctx?: unknown) => {
    const client = globalThis.__mockCountsClient;
    return await handler({ client, request: req, session: {} });
  },
}));

describe('GET /api/account/sonar/audit/counts', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.__mockCountsClient = {
      listRunTemplates: vi.fn(),
      listAuditRuns: vi.fn(),
    };
  });

  it('scheduled_count counts only audit+enabled templates (ignores disabled audit and non-audit templates)', async () => {
    globalThis.__mockCountsClient.listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 't1', observation_class: 'audit', enabled: true },
        { template_id: 't2', observation_class: 'audit', enabled: false },
        { template_id: 't3', observation_class: 'watcher', enabled: true },
      ],
    });
    globalThis.__mockCountsClient.listAuditRuns.mockResolvedValue({ runs: [] });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/counts');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    // only t1 qualifies (audit + enabled)
    expect(body.scheduled_count).toBe(1);
    expect(body.in_flight_count).toBe(0);
  });

  it('in_flight_count equals the number of running runs returned', async () => {
    globalThis.__mockCountsClient.listRunTemplates.mockResolvedValue({ templates: [] });
    globalThis.__mockCountsClient.listAuditRuns.mockResolvedValue({
      runs: [
        { run_id: 'r1', status: 'running' },
        { run_id: 'r2', status: 'running' },
        { run_id: 'r3', status: 'running' },
      ],
    });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/counts');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.scheduled_count).toBe(0);
    expect(body.in_flight_count).toBe(3);
  });

  it('if listAuditRuns rejects, in_flight_count is 0 and scheduled_count still computes (no 500)', async () => {
    globalThis.__mockCountsClient.listRunTemplates.mockResolvedValue({
      templates: [
        { template_id: 't1', observation_class: 'audit', enabled: true },
        { template_id: 't2', observation_class: 'audit', enabled: true },
      ],
    });
    globalThis.__mockCountsClient.listAuditRuns.mockRejectedValue(new Error('haiCore timeout'));

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/counts');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.scheduled_count).toBe(2);
    expect(body.in_flight_count).toBe(0);
  });
});
