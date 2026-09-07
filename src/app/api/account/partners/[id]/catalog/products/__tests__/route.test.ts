import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

type MockHandlerCtx = { client: unknown; request: NextRequest; params?: unknown; session: unknown };

declare global {
  var __mockClient: Record<string, ReturnType<typeof vi.fn>>;
}

vi.mock('@/lib/with-hai-core', () => ({
  withHaiCore: (handler: (ctx: MockHandlerCtx) => unknown) => async (req: NextRequest) => {
    const client = globalThis.__mockClient;
    return await handler({ client, request: req, params: { id: 'vendor-1' }, session: {} });
  },
}));

import { GET } from '../route';

// Catalog search lane (owner ruling R-5b, 2026-09-05): the BFF forwards `q`
// so the suggestion box can ask haiCore instead of loading a page of 500.
describe('GET /api/account/partners/[id]/catalog/products', () => {
  beforeEach(() => {
    globalThis.__mockClient = {
      listCatalogProducts: vi.fn().mockResolvedValue({ products: [], total: 0 }),
    };
  });

  it('forwards q, page and size to haiCore', async () => {
    const req = new NextRequest('http://localhost:3001/api/account/partners/vendor-1/catalog/products?q=valve&page=1&size=20');
    const res = await GET(req, { params: Promise.resolve({ id: 'vendor-1' }) });
    expect(res.status).toBe(200);
    expect(globalThis.__mockClient.listCatalogProducts).toHaveBeenCalledWith(
      'vendor-1',
      expect.objectContaining({ q: 'valve', page: 1, size: 20 }),
    );
  });
});
