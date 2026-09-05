import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchAllCatalogProducts } from '../catalog-products';

function product(i: number) {
  return { external_product_id: `SKU-${i}`, product_name: `Product ${i}`, primary_class_slug: 'fasteners' };
}

afterEach(() => vi.unstubAllGlobals());

describe('fetchAllCatalogProducts (SEC-web-sonar-3-06)', () => {
  it('pages until every product is fetched instead of stopping at the first page', async () => {
    const all = Array.from({ length: 700 }, (_, i) => product(i + 1));
    const requested: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      const url = new URL(String(input), 'http://localhost');
      requested.push(url.search);
      const page = Number(url.searchParams.get('page'));
      const size = Number(url.searchParams.get('size'));
      const slice = all.slice((page - 1) * size, page * size);
      return new Response(JSON.stringify({ products: slice, total: all.length }), { status: 200 });
    }));

    const { products, total } = await fetchAllCatalogProducts('vendor-1');

    expect(total).toBe(700);
    expect(products).toHaveLength(700);
    expect(products.at(-1)?.external_product_id).toBe('SKU-700');
    expect(requested.some((q) => q.includes('page=2'))).toBe(true);
  });
});
