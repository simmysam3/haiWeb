import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';
import { fetchBffJson } from '@/lib/server-fetch';
import { fetchAllCatalogProducts } from '@/lib/catalog-products';
import { NominationForm } from './nomination-form';
import type { InitialState, PartnerSummary } from './types';

interface PartnerRow {
  id: string;
  company_name: string;
  status: string;
}

/**
 * D-62: every BFF read goes through `fetchBffJson`, which takes the origin
 * from the configured PORTAL_BASE_URL (never the request's Host header) and
 * forwards the caller's cookie. Non-OK and network failures both become null.
 */
async function bffJson<T>(path: string): Promise<T | null> {
  const result = await fetchBffJson<T>(path);
  return result.kind === 'ok' ? result.data : null;
}

async function findVendor(vendorId: string): Promise<PartnerSummary | null> {
  const partners = await bffJson<PartnerRow[]>('/api/account/partners');
  if (!partners) return null;
  const match = partners.find((p) => p.id === vendorId);
  if (!match) return null;
  return { id: match.id, legal_name: match.company_name };
}

async function findClass(vendorId: string, classId: string): Promise<CatalogClass | null> {
  const body = await bffJson<{ classes: CatalogClass[] }>(
    `/api/account/partners/${encodeURIComponent(vendorId)}/catalog/classes`,
  );
  if (!body) return null;
  return body.classes?.find((c) => c.class_id === classId) ?? null;
}

async function findProduct(
  vendorId: string,
  productId: string,
): Promise<{ product: CatalogProduct; classId: string } | null> {
  const classesBody = await bffJson<{ classes: CatalogClass[] }>(
    `/api/account/partners/${encodeURIComponent(vendorId)}/catalog/classes`,
  );
  if (!classesBody) return null;
  for (const klass of classesBody.classes ?? []) {
    // The whole class, paged to haiCore's `total` (SEC-web-sonar-3-06): a
    // product past the first 500 must still be found.
    let prodsBody: { products: CatalogProduct[]; total: number } | null;
    try {
      prodsBody = await fetchAllCatalogProducts(vendorId, {
        classId: klass.class_id,
        getPage: async (path) => {
          const page = await bffJson<{ products: CatalogProduct[]; total: number }>(path);
          if (!page) throw new Error('products unavailable');
          return page;
        },
      });
    } catch {
      prodsBody = null;
    }
    if (!prodsBody) continue;
    const match = prodsBody.products.find((p) => p.external_product_id === productId);
    if (match) return { product: match, classId: klass.class_id };
  }
  return null;
}

async function deriveInitialState(
  vendorParam: string | undefined,
  classParam: string | undefined,
  productParam: string | undefined,
): Promise<InitialState> {
  if (!vendorParam) return { kind: 'cold' };

  const vendor = await findVendor(vendorParam);
  if (!vendor) {
    return { kind: 'cold', error: `We couldn't find that vendor (${vendorParam}).` };
  }

  // class_id is authoritative when both are present (documented in spec §6).
  if (classParam) {
    const klass = await findClass(vendor.id, classParam);
    if (klass) return { kind: 'vendor+class', vendor, class: klass };
    return {
      kind: 'vendor',
      vendor,
      error: `Class ${classParam} not found in ${vendor.legal_name}'s catalog.`,
    };
  }

  if (productParam) {
    const result = await findProduct(vendor.id, productParam);
    if (result) {
      return { kind: 'vendor+product', vendor, product: result.product, classId: result.classId };
    }
    return {
      kind: 'vendor',
      vendor,
      error: `Product ${productParam} not found in ${vendor.legal_name}'s catalog.`,
    };
  }

  return { kind: 'vendor', vendor };
}

interface PageProps {
  searchParams: Promise<{ vendor?: string; class_id?: string; product?: string }>;
}

export default async function NominationsNewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialState = await deriveInitialState(params.vendor, params.class_id, params.product);
  return (
    <div>
      <NominationForm initialState={initialState} />
    </div>
  );
}
