import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHaiwaveClient } from '../haiwave-api';

// Catalog search lane (owner ruling R-5b, 2026-09-05): haiCore's
// GET /participants/:vendor_id/catalog-products takes `q` (SKU / product-name
// match, server-side). The client carries it as one opaque query value.

function mockFetchOnce(body: unknown = { products: [], total: 0 }) {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('HaiwaveClient.listCatalogProducts — q on the wire', () => {
  let client: ReturnType<typeof createHaiwaveClient>;
  beforeEach(() => {
    client = createHaiwaveClient('tok', 'pid-1234');
  });

  it('sends q as one opaque query value beside page and size', async () => {
    const fetchMock = mockFetchOnce();
    await client.listCatalogProducts('vendor-1', { q: 'valve 4&x', page: 1, size: 20 });
    const [rawUrl] = fetchMock.mock.calls[0] as [string];
    const url = new URL(String(rawUrl));
    expect(url.pathname).toBe('/api/v1/participants/vendor-1/catalog-products');
    expect(url.searchParams.get('q')).toBe('valve 4&x');
    expect(url.searchParams.get('size')).toBe('20');
  });
});
