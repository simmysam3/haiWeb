import { cookies, headers } from 'next/headers';
import type { CatalogClass, CatalogProduct } from '@/lib/haiwave-api';
import { NominationForm } from './nomination-form';
import type { InitialState, PartnerSummary } from './types';

interface PartnerRow {
  id: string;
  company_name: string;
  status: string;
}

async function getBaseUrl() {
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3001';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

async function authedFetch(path: string): Promise<Response> {
  const baseUrl = await getBaseUrl();
  const cookieHeader = (await cookies()).toString();
  return fetch(`${baseUrl}${path}`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });
}

async function findVendor(vendorId: string): Promise<PartnerSummary | null> {
  const res = await authedFetch('/api/account/partners');
  if (!res.ok) return null;
  const partners = (await res.json()) as PartnerRow[];
  const match = partners.find((p) => p.id === vendorId);
  if (!match) return null;
  return { id: match.id, legal_name: match.company_name };
}

async function findClass(vendorId: string, classId: string): Promise<CatalogClass | null> {
  const res = await authedFetch(
    `/api/account/partners/${encodeURIComponent(vendorId)}/catalog/classes`,
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { classes: CatalogClass[] };
  return body.classes?.find((c) => c.class_id === classId) ?? null;
}

async function findProduct(
  vendorId: string,
  productId: string,
): Promise<{ product: CatalogProduct; classId: string } | null> {
  const classesRes = await authedFetch(
    `/api/account/partners/${encodeURIComponent(vendorId)}/catalog/classes`,
  );
  if (!classesRes.ok) return null;
  const { classes } = (await classesRes.json()) as { classes: CatalogClass[] };
  for (const klass of classes ?? []) {
    const prodsRes = await authedFetch(
      `/api/account/partners/${encodeURIComponent(vendorId)}/catalog/products?class_id=${encodeURIComponent(klass.class_id)}&page=1&size=500`,
    );
    if (!prodsRes.ok) continue;
    const { products } = (await prodsRes.json()) as { products: CatalogProduct[]; total: number };
    const match = products?.find((p) => p.external_product_id === productId);
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
