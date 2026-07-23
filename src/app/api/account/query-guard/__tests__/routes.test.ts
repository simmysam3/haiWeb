import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockClient = {
  listQueryGuardRules: vi.fn(),
  upsertQueryGuardRule: vi.fn(),
  getQueryGuardMatrix: vi.fn(),
  testQueryGuardRules: vi.fn(),
  listQueryGuardStates: vi.fn(),
  restoreQueryGuardState: vi.fn(),
  clearQueryGuardState: vi.fn(),
  listQueryGuardEvents: vi.fn(),
  getQueryGuardSettings: vi.fn(),
  putQueryGuardSettings: vi.fn(),
};

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) =>
    async (request: unknown, routeCtx?: { params: Promise<Record<string, string>> }) =>
      handler({
        client: mockClient,
        session: { participant: { id: 'pid' } },
        request,
        params: routeCtx ? await routeCtx.params : {},
      }),
}));

describe('query-guard BFF routes', () => {
  beforeEach(() => {
    for (const fn of Object.values(mockClient)) fn.mockReset();
  });

  it('PUT rules forwards body to upsertQueryGuardRule', async () => {
    mockClient.upsertQueryGuardRule.mockResolvedValueOnce({ id: 'r1' });
    const { PUT } = await import('../rules/route');
    const body = {
      scope: 'client_global',
      trust_class: null,
      rule_type: 'sku_repeat',
      window: 'day',
      threshold: 5,
      origin_filter: 'any',
      actions: [{ type: 'log' }],
      enabled: true,
    };
    const res = await PUT(
      new NextRequest('http://localhost/x', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }),
      { params: Promise.resolve({}) },
    );
    expect(mockClient.upsertQueryGuardRule).toHaveBeenCalledWith(body);
    expect(res.status).toBe(200);
  });

  it('GET resolved returns the matrix', async () => {
    mockClient.getQueryGuardMatrix.mockResolvedValueOnce({ matrix: [] });
    const { GET } = await import('../rules/resolved/route');
    const res = await GET(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
  });

  it('POST restore forwards the state id', async () => {
    mockClient.restoreQueryGuardState.mockResolvedValueOnce({ id: 's1', kind: 'block' });
    const { POST } = await import('../states/[id]/restore/route');
    await POST(new NextRequest('http://localhost/x', { method: 'POST' }), {
      params: Promise.resolve({ id: 's1' }),
    });
    expect(mockClient.restoreQueryGuardState).toHaveBeenCalledWith('s1');
  });
});
