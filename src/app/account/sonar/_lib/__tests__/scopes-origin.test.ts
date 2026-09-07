import { describe, it, vi, beforeEach } from 'vitest';
import { expectConfiguredOrigin } from '@/test/spoofed-request';

vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);

const fetchMock = vi.fn(async () =>
  new Response(JSON.stringify({ scopes: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('getActiveScopes fetch origin (D-62)', () => {
  it('fetches audit scopes from the configured portal origin, not the request Host header', async () => {
    const { getActiveScopes } = await import('../scopes');
    await getActiveScopes();
    expectConfiguredOrigin(fetchMock);
  });
});
