import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: unknown) => unknown) => async (request: NextRequest) => {
    return handler({ client: {}, request, session: { user: { id: 'u-1' } }, params: {} });
  },
}));

const url = 'http://localhost/api/account/sonar/watcher/triage-alerts';

describe('GET /api/account/sonar/watcher/triage-alerts', () => {
  it('returns an empty alerts array (v1 placeholder)', async () => {
    const { GET } = await import('../route');
    const res = await GET(new NextRequest(url), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ alerts: [] });
  });
});
