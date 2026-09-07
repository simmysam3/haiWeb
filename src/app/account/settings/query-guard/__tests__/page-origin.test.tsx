import { describe, it, vi, beforeEach } from 'vitest';
import { expectConfiguredOrigin } from '@/test/spoofed-request';

vi.mock('next/headers', async () => (await import('@/test/spoofed-request')).nextHeadersMock);

const fetchMock = vi.fn(async () =>
  new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
);

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

describe('QueryGuardPage fetch origin (D-62)', () => {
  it('loads every query-guard lane from the configured portal origin, not the request Host header', async () => {
    const Page = (await import('../page')).default;
    await Page();
    expectConfiguredOrigin(fetchMock);
  });
});
