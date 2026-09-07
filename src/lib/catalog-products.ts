import type { CatalogProduct } from '@/lib/haiwave-api';

export interface CatalogProducts {
  products: CatalogProduct[];
  /** haiCore's count for the whole set (or the class), not the page. */
  total: number;
}

const PAGE_SIZE = 500;

/**
 * Every product of a counterparty's catalog — optionally one class — paged
 * until haiCore's `total` is reached. haiCore applies no size cap; a single
 * `page=1&size=500` was only ever the client's ceiling, and a scope saved from
 * that page silently omitted SKUs 501+ (SEC-web-sonar-3-06). Throws on a
 * non-2xx so callers surface the failure rather than a partial list.
 */
type CatalogPage = { products?: CatalogProduct[]; total?: number };

/** Default page reader: the browser's fetch against the BFF; throws on a non-2xx. */
async function fetchPage(path: string): Promise<CatalogPage> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`products ${res.status}`);
  return (await res.json()) as CatalogPage;
}

export async function fetchAllCatalogProducts(
  vendorId: string,
  opts: {
    classId?: string;
    pageSize?: number;
    /** Server components pass their cookie-forwarding BFF reader here (D-62). */
    getPage?: (path: string) => Promise<CatalogPage>;
  } = {},
): Promise<CatalogProducts> {
  const size = opts.pageSize ?? PAGE_SIZE;
  const getPage = opts.getPage ?? fetchPage;
  const products: CatalogProduct[] = [];
  let total = 0;
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (opts.classId) params.set('class_id', opts.classId);
    const body = await getPage(
      `/api/account/partners/${encodeURIComponent(vendorId)}/catalog/products?${params.toString()}`,
    );
    const batch = body.products ?? [];
    products.push(...batch);
    total = body.total ?? products.length;
    if (batch.length === 0 || products.length >= total) break;
  }
  return { products, total };
}
