import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: any) => async (req: NextRequest, _ctx?: any) => {
    const client = (globalThis as any).__mockClient;
    return await handler({ client, request: req, session: {} });
  },
}));

describe('GET /api/account/sonar/audit/runs', () => {
  beforeEach(() => {
    (globalThis as any).__mockClient = {
      listAuditRuns: vi.fn(),
      triggerAuditRun: vi.fn(),
    };
  });

  it('forwards status and limit query params to listAuditRuns and returns { runs }', async () => {
    const mockRuns = [
      { run_id: 'r1', status: 'complete', triggered_at: '2026-05-21T10:00:00Z' },
    ];
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({ runs: mockRuns });

    const { GET } = await import('../route');
    const req = new NextRequest(
      'http://localhost:3001/api/account/sonar/audit/runs?status=complete&limit=10',
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body).toEqual({ runs: mockRuns });
    expect((globalThis as any).__mockClient.listAuditRuns).toHaveBeenCalledWith({
      status: 'complete',
      limit: 10,
    });
  });

  it('calls listAuditRuns with no filters when no query params are present', async () => {
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({ runs: [] });

    const { GET } = await import('../route');
    const req = new NextRequest(
      'http://localhost:3001/api/account/sonar/audit/runs',
    );
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body).toEqual({ runs: [] });
    // called with an object that has no status/limit keys set (both undefined)
    const callArg = (globalThis as any).__mockClient.listAuditRuns.mock.calls[0][0];
    expect(callArg.status).toBeUndefined();
    expect(callArg.limit).toBeUndefined();
  });
});

describe('POST /api/account/sonar/audit/runs', () => {
  beforeEach(() => {
    (globalThis as any).__mockClient = {
      listAuditRuns: vi.fn(),
      triggerAuditRun: vi.fn(),
    };
  });

  it('forwards the request body to triggerAuditRun and returns its result', async () => {
    const mockResult = { run_id: 'r-new', status: 'pending' };
    (globalThis as any).__mockClient.triggerAuditRun.mockResolvedValue(mockResult);

    const { POST } = await import('../route');
    const reqBody = { scope_type: 'company', scope_ids: ['org-1'], depth_limit: 2, hop_budget: 10 };
    const req = new NextRequest(
      'http://localhost:3001/api/account/sonar/audit/runs',
      {
        method: 'POST',
        body: JSON.stringify(reqBody),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const res = await POST(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body).toEqual(mockResult);
    const callArg = (globalThis as any).__mockClient.triggerAuditRun.mock.calls[0][0];
    // body forwarded as-is
    expect(callArg).toEqual(reqBody);
    // run_origin must NOT be injected by the BFF
    expect(callArg).not.toHaveProperty('run_origin');
  });
});
