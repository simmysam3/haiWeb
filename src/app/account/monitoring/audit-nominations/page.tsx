import { headers } from 'next/headers';
import type { InboundNominationGroup } from './_lib/types';
import { NominationsTable } from './nominations-table';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';

interface SearchParams {
  status?: string | string[];
  observer_id?: string | string[];
  product_class?: string | string[];
}

type FetchResult =
  | { kind: 'ok'; groups: InboundNominationGroup[] }
  | { kind: 'error'; status: number };

async function fetchQueue(searchParams: SearchParams): Promise<FetchResult> {
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
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    return { kind: 'ok', groups: (await res.json()) as InboundNominationGroup[] };
  } catch {
    return { kind: 'error', status: 0 };
  }
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function AuditNominationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await fetchQueue(params);

  return (
    <div className="px-8 py-10">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">Audit Nominations</h1>
          <p className="mt-2 text-slate">
            Incoming nomination requests from upstream observers.
          </p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro>
        The inbound queue of audit obligations partners have nominated you to satisfy — each one a SKU your buyer wants you to disclose downstream provenance for. Acknowledge, respond, or decline obligations here; counterparties in trust classes you&apos;ve enabled bypass for auto-acknowledge and won&apos;t appear in this queue. The mirror of <em>Sonar → My Nominations</em>, which is what you&apos;ve sent in the other direction.
      </PageIntro>

      <FilterPills
        observers={
          result.kind === 'ok'
            ? Array.from(
                new Map(
                  result.groups.flatMap((g) =>
                    g.observers.map((o) => [
                      o.observer_participant_id,
                      { id: o.observer_participant_id, name: o.observer_display_name },
                    ]),
                  ),
                ).values(),
              )
            : []
        }
      />

      {result.kind === 'error' ? (
        <div className="rounded-lg border border-red-300 bg-red-50 p-12 text-center">
          <p className="text-red-900">
            Couldn&apos;t load nominations. The audit service is temporarily unavailable.
          </p>
        </div>
      ) : result.groups.length === 0 ? (
        <div className="rounded-lg border border-slate/20 bg-white p-12 text-center">
          <p className="text-slate">
            No incoming nominations. New requests appear here when upstream
            observers nominate your SKUs for audit.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate/20 bg-white">
          <NominationsTable groups={result.groups} />
        </div>
      )}
    </div>
  );
}
