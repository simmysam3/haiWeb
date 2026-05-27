import { headers } from 'next/headers';
import type { DownstreamGapEntry } from '@haiwave/protocol';
import { GapsTable } from './gaps-table';
import { LeastCompliantPanel } from './least-compliant-panel';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';
import { PageHeader } from '@/components';

interface SearchParams {
  resolution_class?: string | string[];
  on_network_status?: string | string[];
  min_request_count?: string;
}

type FetchResult =
  | { kind: 'ok'; entries: DownstreamGapEntry[] }
  | { kind: 'error'; status: number };

async function fetchGaps(searchParams: SearchParams): Promise<FetchResult> {
  const sp = new URLSearchParams();
  for (const key of ['resolution_class', 'on_network_status'] as const) {
    const v = searchParams[key];
    if (Array.isArray(v)) v.forEach((x) => sp.append(key, x));
    else if (v) sp.append(key, v);
  }
  if (searchParams.min_request_count) sp.set('min_request_count', searchParams.min_request_count);

  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sku-obligations/downstream-gaps?${sp}`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    return { kind: 'ok', entries: (await res.json()) as DownstreamGapEntry[] };
  } catch {
    return { kind: 'error', status: 0 };
  }
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function DownstreamGapsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await fetchGaps(params);

  return (
    <div>
      <PageHeader
        title="Obligations"
        description="Inbound requests from your customers asking you to resolve downstream gaps in your supply tree — sub-tier vendors off-network, slow responders, or SKUs with insufficient disclosure."
        actions={<RefreshButton />}
      />
      <PageIntro>
        Each row is a compliance obligation that one of your customers has accepted on your behalf and is now waiting for you to close. You owe them a response: either drive a sub-tier vendor to disclose (the participant + invited rows), invite a non-participant counterparty (the not-invited rows), or escalate via support. Filter by resolution class to focus on what&apos;s actionable today.
      </PageIntro>

      <FilterPills />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-slate/20 bg-white">
          {result.kind === 'error' ? (
            <div className="p-12 text-center">
              <p className="text-red-900">
                Couldn&apos;t load downstream gaps. The monitoring service is temporarily unavailable.
              </p>
            </div>
          ) : result.entries.length === 0 ? (
            <div className="p-12 text-center text-slate">
              No downstream gaps. This list populates after you accept inbound
              nominations and your runs surface unresolved sub-tier
              obligations.
            </div>
          ) : (
            <GapsTable entries={result.entries} />
          )}
        </div>
        <LeastCompliantPanel />
      </div>
    </div>
  );
}
