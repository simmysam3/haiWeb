import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const MOCK_PARTICIPANT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

type MockHandlerCtx = { client: unknown; request: NextRequest; params?: unknown; session: unknown };

declare global {
  var __mockClient: Record<string, ReturnType<typeof vi.fn>>;
}

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: MockHandlerCtx) => unknown) => async (req: NextRequest, _ctx?: unknown) => {
    const client = globalThis.__mockClient;
    return await handler({
      client,
      request: req,
      session: { participant: { id: MOCK_PARTICIPANT_ID } },
    });
  },
}));

describe('GET /api/account/sonar/audit/runs', () => {
  beforeEach(() => {
    globalThis.__mockClient = {
      listAuditRuns: vi.fn(),
      triggerAuditRun: vi.fn(),
      getCompanyProfile: vi.fn(),
      listRunTemplates: vi.fn(),
    };
  });

  it('forwards status and limit query params to listAuditRuns', async () => {
    globalThis.__mockClient.listAuditRuns.mockResolvedValue({ runs: [] });

    const { GET } = await import('../route');
    const req = new NextRequest(
      'http://localhost:3001/api/account/sonar/audit/runs?status=complete&limit=10',
    );
    await GET(req, { params: Promise.resolve({}) });

    expect(globalThis.__mockClient.listAuditRuns).toHaveBeenCalledWith({
      status: 'complete',
      limit: 10,
    });
  });

  it('calls listAuditRuns with no filters when no query params are present', async () => {
    globalThis.__mockClient.listAuditRuns.mockResolvedValue({ runs: [] });

    const { GET } = await import('../route');
    const req = new NextRequest(
      'http://localhost:3001/api/account/sonar/audit/runs',
    );
    await GET(req, { params: Promise.resolve({}) });

    const callArg = globalThis.__mockClient.listAuditRuns.mock.calls[0][0];
    expect(callArg.status).toBeUndefined();
    expect(callArg.limit).toBeUndefined();
  });

  it('enriches runs with template_name and surfaces auditor_country', async () => {
    globalThis.__mockClient.listAuditRuns.mockResolvedValue({
      runs: [
        // haiCore now attaches the SKU aggregates directly to each run;
        // the BFF just passes them through.
        {
          run_id: 'r1',
          status: 'complete',
          triggered_at: '2026-05-21T10:00:00Z',
          template_id: 't1',
          total_skus: 78,
          fully_resolved_skus_by_country: { US: 42, CA: 3 },
        },
      ],
    });
    globalThis.__mockClient.getCompanyProfile.mockResolvedValue({
      id: MOCK_PARTICIPANT_ID,
      company_name: 'Apex',
      locality: { country: 'us' },
    });
    globalThis.__mockClient.listRunTemplates.mockResolvedValue({
      templates: [{ template_id: 't1', template_name: 'Q1 Coffee Sweep' }],
    });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({
      run_id: 'r1',
      template_name: 'Q1 Coffee Sweep',
      total_skus: 78,
      fully_resolved_skus_by_country: { US: 42, CA: 3 },
    });
    expect(body.auditor_country).toBe('US');
  });

  it('does not call getAuditRunResults (haiCore aggregates server-side)', async () => {
    globalThis.__mockClient.getAuditRunResults = vi.fn();
    globalThis.__mockClient.listAuditRuns.mockResolvedValue({
      runs: [{ run_id: 'r1', status: 'complete', triggered_at: '2026-05-21T10:00:00Z' }],
    });
    globalThis.__mockClient.getCompanyProfile.mockResolvedValue({
      locality: { country: 'US' },
    });
    globalThis.__mockClient.listRunTemplates.mockResolvedValue({ templates: [] });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    await GET(req, { params: Promise.resolve({}) });

    expect(globalThis.__mockClient.getAuditRunResults).not.toHaveBeenCalled();
  });

  it('returns auditor_country undefined when profile fetch rejects (best-effort)', async () => {
    globalThis.__mockClient.listAuditRuns.mockResolvedValue({ runs: [] });
    globalThis.__mockClient.getCompanyProfile.mockRejectedValue(new Error('boom'));
    globalThis.__mockClient.listRunTemplates.mockResolvedValue({ templates: [] });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auditor_country).toBeUndefined();
  });
});

// v1.85 — the audit definition page shows only that audit's runs, so the BFF
// forwards `?template_id=` to the haiCore client (which applies the filter —
// haiCore's own list takes status + limit only). The fake honours
// `template_id` the way the real client does; assertions are on the body.
describe('GET /api/account/sonar/audit/runs?template_id=', () => {
  const RUNS = [
    { run_id: 'r-1', template_id: 'a-1', status: 'complete', triggered_at: '2026-09-01T10:00:00Z' },
    { run_id: 'r-2', template_id: 'a-2', status: 'complete', triggered_at: '2026-09-01T10:00:00Z' },
    { run_id: 'r-3', template_id: null, status: 'complete', triggered_at: '2026-09-01T10:00:00Z' },
  ];

  beforeEach(() => {
    globalThis.__mockClient = {
      listAuditRuns: vi.fn(async (opts: { template_id?: string } = {}) => ({
        runs: opts.template_id ? RUNS.filter((r) => r.template_id === opts.template_id) : RUNS,
      })),
      getCompanyProfile: vi.fn(async () => ({ locality: { country: 'gb' } })),
      listRunTemplates: vi.fn(async () => ({
        templates: [
          { template_id: 'a-1', template_name: 'Weekly EMEA Audit' },
          { template_id: 'a-2', template_name: 'Other Audit' },
        ],
      })),
    };
  });

  it('returns every run when no template_id is given', async () => {
    const { GET } = await import('../route');
    const res = await GET(new NextRequest('http://localhost:3001/api/account/sonar/audit/runs'), {
      params: Promise.resolve({}),
    });
    const body = (await res.json()) as { runs: Array<{ run_id: string }> };
    expect(body.runs.map((r) => r.run_id)).toEqual(['r-1', 'r-2', 'r-3']);
  });

  it("returns only that template's runs, names still joined", async () => {
    const { GET } = await import('../route');
    const res = await GET(
      new NextRequest('http://localhost:3001/api/account/sonar/audit/runs?template_id=a-1'),
      { params: Promise.resolve({}) },
    );
    const body = (await res.json()) as { runs: Array<{ run_id: string; template_name?: string }> };
    expect(body.runs.map((r) => r.run_id)).toEqual(['r-1']);
    expect(body.runs[0].template_name).toBe('Weekly EMEA Audit');
  });
});

// v1.85 (2026-09-02): archived runs are excluded server-side by default;
// ?archived=true opts the caller in to seeing them.
describe('GET /api/account/sonar/audit/runs?archived=', () => {
  beforeEach(() => {
    globalThis.__mockClient = {
      listAuditRuns: vi.fn(async () => ({ runs: [] })),
      getCompanyProfile: vi.fn(async () => ({ locality: { country: 'us' } })),
      listRunTemplates: vi.fn(async () => ({ templates: [] })),
    };
  });

  it('forwards archived=true to listAuditRuns', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs?archived=true');
    await GET(req, { params: Promise.resolve({}) });

    expect(globalThis.__mockClient.listAuditRuns).toHaveBeenCalledWith({
      status: undefined,
      limit: undefined,
      template_id: undefined,
      archived: true,
    });
  });

  it('does not forward archived when the param is absent', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    await GET(req, { params: Promise.resolve({}) });

    const callArg = globalThis.__mockClient.listAuditRuns.mock.calls[0][0];
    expect(callArg.archived).toBeUndefined();
  });

  it('does not forward archived when the value is not "true"', async () => {
    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs?archived=false');
    await GET(req, { params: Promise.resolve({}) });

    const callArg = globalThis.__mockClient.listAuditRuns.mock.calls[0][0];
    expect(callArg.archived).toBeUndefined();
  });
});

describe('POST /api/account/sonar/audit/runs', () => {
  it('is not exported — ad-hoc triggers create nameless template-less runs; the wizard path (definitions + /run) is the only trigger', async () => {
    const mod = await import('../route');
    expect((mod as Record<string, unknown>).POST).toBeUndefined();
  });
});

describe('POST /api/account/audit-runs (legacy)', () => {
  it('is not exported — same ad-hoc trigger surface, no UI callers', async () => {
    const mod = await import('../../../../audit-runs/route');
    expect((mod as Record<string, unknown>).POST).toBeUndefined();
  });
});
