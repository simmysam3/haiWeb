import { headers } from 'next/headers';
import type { InboundNominationGroup } from './_lib/types';
import { NominationsTable } from './nominations-table';

interface SearchParams {
  status?: string | string[];
  observer_id?: string | string[];
  product_class?: string | string[];
}

async function fetchQueue(searchParams: SearchParams): Promise<InboundNominationGroup[]> {
  const sp = new URLSearchParams();
  for (const key of ['status', 'observer_id', 'product_class'] as const) {
    const v = searchParams[key];
    if (Array.isArray(v)) v.forEach((x) => sp.append(key, x));
    else if (v) sp.append(key, v);
  }
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sku-obligations/responder-queue?${sp}`;
  const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
  if (!res.ok) return [];
  return res.json();
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function AuditNominationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const groups = await fetchQueue(params);

  return (
    <div className="px-8 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">Audit Nominations</h1>
          <p className="mt-2 text-slate">
            Incoming nomination requests from upstream observers.
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-slate/20 bg-white p-12 text-center">
          <p className="text-slate">
            No incoming nominations. New requests appear here when upstream
            observers nominate your SKUs for audit.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate/20 bg-white">
          <NominationsTable groups={groups} />
        </div>
      )}
    </div>
  );
}
