/**
 * Tests for GET /api/account/sonar/audit/runs/[run_id]
 *
 * NOTE on dispatched_responses:
 *   EvidenceResponseListItem (protocol v3.x as of v.1.39) has NO run-linking
 *   field (no source_run_ids or bound_run_id on the list shape). The route
 *   therefore always returns dispatched_responses: [] — the field is
 *   forward-looking for a future phase where the protocol adds a linking field.
 *   Tests 1 and 2 assert the empty-list contract. Test 3 asserts the
 *   best-effort resilience: a failure in listEvidenceResponses must not 500.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: any) => async (req: NextRequest, ctx?: any) => {
    const client = (globalThis as any).__mockClient;
    const params = ctx?.params instanceof Promise ? await ctx.params : (ctx?.params ?? {});
    return await handler({ client, request: req, session: {}, params });
  },
}));

const RUN_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const MOCK_RUN = {
  run_id: RUN_ID,
  status: 'complete',
  triggered_at: '2026-05-21T10:00:00Z',
};

// Protocol list items have no source_run_ids — only these fields exist:
const MOCK_RESPONSE_ITEM = {
  response_id: 'resp-1',
  scope_shape: 'sku_list',
  sku_count: 3,
  recipient_name: 'US Customs',
  recipient_type: 'customs',
  exported_at: '2026-05-21T09:00:00Z',
  exported_by: 'user-1',
  document_hash: 'abc123',
};

describe('GET /api/account/sonar/audit/runs/[run_id]', () => {
  beforeEach(() => {
    vi.resetModules();
    (globalThis as any).__mockClient = {
      getAuditRun: vi.fn(),
      listEvidenceResponses: vi.fn(),
    };
  });

  it('returns { run, dispatched_responses: [] } — list items carry no run-linking field in v.1.39', async () => {
    (globalThis as any).__mockClient.getAuditRun.mockResolvedValue(MOCK_RUN);
    // Even if responses exist, none can be linked to this run (no linking field),
    // so the route no longer fetches them at all — it returns [] directly (forward seam).
    (globalThis as any).__mockClient.listEvidenceResponses.mockResolvedValue({
      responses: [MOCK_RESPONSE_ITEM],
    });

    const { GET } = await import('../route');
    const req = new NextRequest(
      `http://localhost:3001/api/account/sonar/audit/runs/${RUN_ID}`,
    );
    const res = await GET(req, { params: Promise.resolve({ run_id: RUN_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.run).toEqual(MOCK_RUN);
    // No run-linking field → always [] in v.1.39
    expect(body.dispatched_responses).toEqual([]);
    expect((globalThis as any).__mockClient.getAuditRun).toHaveBeenCalledWith(RUN_ID);
    // Forward seam: the route returns [] WITHOUT fetching responses (the wasted
    // listEvidenceResponses call was removed — re-add once a run-link field exists).
    expect((globalThis as any).__mockClient.listEvidenceResponses).not.toHaveBeenCalled();
  });

  it('returns dispatched_responses: [] when response list is empty', async () => {
    (globalThis as any).__mockClient.getAuditRun.mockResolvedValue(MOCK_RUN);
    (globalThis as any).__mockClient.listEvidenceResponses.mockResolvedValue({
      responses: [],
    });

    const { GET } = await import('../route');
    const req = new NextRequest(
      `http://localhost:3001/api/account/sonar/audit/runs/${RUN_ID}`,
    );
    const res = await GET(req, { params: Promise.resolve({ run_id: RUN_ID }) });
    const body = await res.json();

    expect(body.run).toEqual(MOCK_RUN);
    expect(body.dispatched_responses).toEqual([]);
  });

  it('returns run with dispatched_responses: [] when listEvidenceResponses rejects (best-effort resilience)', async () => {
    (globalThis as any).__mockClient.getAuditRun.mockResolvedValue(MOCK_RUN);
    (globalThis as any).__mockClient.listEvidenceResponses.mockRejectedValue(
      new Error('service unavailable'),
    );

    const { GET } = await import('../route');
    const req = new NextRequest(
      `http://localhost:3001/api/account/sonar/audit/runs/${RUN_ID}`,
    );
    const res = await GET(req, { params: Promise.resolve({ run_id: RUN_ID }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run).toEqual(MOCK_RUN);
    expect(body.dispatched_responses).toEqual([]);
  });
});
