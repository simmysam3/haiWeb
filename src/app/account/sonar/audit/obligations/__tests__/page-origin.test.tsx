import { describe, it, vi, beforeEach } from 'vitest';
import { expectConfiguredOrigin } from '@/test/spoofed-request';

vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);

// Both lanes on this page (downstream gaps + the audit-scopes check) return
// an ok-empty body; the assertion is about which origin they targeted.
const fetchMock = vi.fn(async (input: string | URL) =>
  new Response(String(input).includes('/definitions') ? JSON.stringify({ templates: [] }) : '[]', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  }),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('DownstreamGapsPage fetch origin (D-62)', () => {
  it('loads downstream gaps from the configured portal origin, not the request Host header', async () => {
    const Page = (await import('../page')).default;
    await Page({ searchParams: Promise.resolve({}) });
    expectConfiguredOrigin(fetchMock);
  });
});
