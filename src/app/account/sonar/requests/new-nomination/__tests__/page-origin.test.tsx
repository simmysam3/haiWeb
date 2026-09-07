import { describe, it, vi, beforeEach } from 'vitest';
import { expectConfiguredOrigin } from '@/test/spoofed-request';

vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);

// Partner lookup returns nobody, so the page resolves to a cold state after
// exactly one BFF call — enough to observe which origin it targeted.
const fetchMock = vi.fn(async () =>
  new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('NominationsNewPage fetch origin (D-62)', () => {
  it('looks the vendor up at the configured portal origin, not the request Host header', async () => {
    const Page = (await import('../page')).default;
    await Page({ searchParams: Promise.resolve({ vendor: 'v1' }) });
    expectConfiguredOrigin(fetchMock);
  });
});
