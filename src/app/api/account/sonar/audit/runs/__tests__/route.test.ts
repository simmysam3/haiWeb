import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const MOCK_PARTICIPANT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: any) => async (req: NextRequest, _ctx?: any) => {
    const client = (globalThis as any).__mockClient;
    return await handler({
      client,
      request: req,
      session: { participant: { id: MOCK_PARTICIPANT_ID } },
    });
  },
}));

describe('GET /api/account/sonar/audit/runs', () => {
  beforeEach(() => {
    (globalThis as any).__mockClient = {
      listAuditRuns: vi.fn(),
      triggerAuditRun: vi.fn(),
      getCompanyProfile: vi.fn(),
      listRunTemplates: vi.fn(),
      getAuditRunResults: vi.fn(),
    };
  });

  it('forwards status and limit query params to listAuditRuns', async () => {
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({ runs: [] });

    const { GET } = await import('../route');
    const req = new NextRequest(
      'http://localhost:3001/api/account/sonar/audit/runs?status=complete&limit=10',
    );
    await GET(req, { params: Promise.resolve({}) });

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
    await GET(req, { params: Promise.resolve({}) });

    const callArg = (globalThis as any).__mockClient.listAuditRuns.mock.calls[0][0];
    expect(callArg.status).toBeUndefined();
    expect(callArg.limit).toBeUndefined();
  });

  it('enriches complete runs with template_name + domestic/total counts', async () => {
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({
      runs: [
        {
          run_id: 'r1',
          status: 'complete',
          triggered_at: '2026-05-21T10:00:00Z',
          template_id: 't1',
        },
      ],
    });
    (globalThis as any).__mockClient.getCompanyProfile.mockResolvedValue({
      id: MOCK_PARTICIPANT_ID,
      company_name: 'Apex',
      locality: { city: 'Austin', state: 'TX', country: 'us' },
    });
    (globalThis as any).__mockClient.listRunTemplates.mockResolvedValue({
      templates: [{ template_id: 't1', template_name: 'Q1 Coffee Sweep' }],
    });
    // 3 SKUs total: 2 fully US-domestic, 1 with a foreign component.
    (globalThis as any).__mockClient.getAuditRunResults.mockResolvedValue({
      results: [
        { geo_rollup: [{ country_of_origin: 'US', component_count: 5, depth_distribution: {} }] },
        { geo_rollup: [{ country_of_origin: 'US', component_count: 2, depth_distribution: {} }] },
        {
          geo_rollup: [
            { country_of_origin: 'US', component_count: 1, depth_distribution: {} },
            { country_of_origin: 'CN', component_count: 1, depth_distribution: {} },
          ],
        },
      ],
    });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({
      run_id: 'r1',
      template_name: 'Q1 Coffee Sweep',
      domestic_count: 2,
      total_count: 3,
    });
    expect(body.auditor_country).toBe('US');
  });

  it('disqualifies SKUs with any <unknown> origin entry from the domestic count', async () => {
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({
      runs: [{ run_id: 'r1', status: 'complete', triggered_at: '2026-05-21T10:00:00Z' }],
    });
    (globalThis as any).__mockClient.getCompanyProfile.mockResolvedValue({
      locality: { country: 'US' },
    });
    (globalThis as any).__mockClient.listRunTemplates.mockResolvedValue({ templates: [] });
    (globalThis as any).__mockClient.getAuditRunResults.mockResolvedValue({
      results: [
        // Fully resolved + domestic — counts.
        { geo_rollup: [{ country_of_origin: 'US', component_count: 1, depth_distribution: {} }] },
        // Has '<unknown>' alongside US — should NOT count as domestic.
        {
          geo_rollup: [
            { country_of_origin: 'US', component_count: 1, depth_distribution: {} },
            { country_of_origin: '<unknown>', component_count: 1, depth_distribution: {} },
          ],
        },
        // Empty rollup — should NOT count.
        { geo_rollup: [] },
      ],
    });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.runs[0]).toMatchObject({ domestic_count: 1, total_count: 3 });
  });

  it('does not fetch results for non-terminal runs (running)', async () => {
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({
      runs: [{ run_id: 'r1', status: 'running', triggered_at: '2026-05-21T10:00:00Z' }],
    });
    (globalThis as any).__mockClient.getCompanyProfile.mockResolvedValue({
      locality: { country: 'US' },
    });
    (globalThis as any).__mockClient.listRunTemplates.mockResolvedValue({ templates: [] });

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(body.runs[0]).toMatchObject({ domestic_count: null, total_count: null });
    expect((globalThis as any).__mockClient.getAuditRunResults).not.toHaveBeenCalled();
  });

  it('leaves counts null when results fetch fails for a run (best-effort)', async () => {
    (globalThis as any).__mockClient.listAuditRuns.mockResolvedValue({
      runs: [{ run_id: 'r1', status: 'complete', triggered_at: '2026-05-21T10:00:00Z' }],
    });
    (globalThis as any).__mockClient.getCompanyProfile.mockResolvedValue({
      locality: { country: 'US' },
    });
    (globalThis as any).__mockClient.listRunTemplates.mockResolvedValue({ templates: [] });
    (globalThis as any).__mockClient.getAuditRunResults.mockRejectedValue(new Error('boom'));

    const { GET } = await import('../route');
    const req = new NextRequest('http://localhost:3001/api/account/sonar/audit/runs');
    const res = await GET(req, { params: Promise.resolve({}) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.runs[0]).toMatchObject({ domestic_count: null, total_count: null });
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
