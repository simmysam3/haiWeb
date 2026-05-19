import { headers } from 'next/headers';
import type { WorkingListResponse } from '@haiwave/protocol';
import { WorkingListTable } from './working-list-table';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';

interface SearchParams { categories?: string; status?: string; sort?: string; partner_id?: string; }
type FetchResult = { kind: 'ok'; data: WorkingListResponse } | { kind: 'error'; status: number };

async function fetchList(sp: SearchParams): Promise<FetchResult> {
  const qs = new URLSearchParams();
  if (sp.categories) qs.set('categories', sp.categories);
  if (sp.status) qs.set('status', sp.status);
  if (sp.sort) qs.set('sort', sp.sort);
  if (sp.partner_id) qs.set('partner_id', sp.partner_id);
  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sonar/compliance/working-list?${qs}`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    return { kind: 'ok', data: (await res.json()) as WorkingListResponse };
  } catch (e) { console.error('[working-list/page] fetch threw:', e); return { kind: 'error', status: 0 }; }
}

interface PageProps { searchParams: Promise<SearchParams>; }

export default async function WorkingListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await fetchList(params);
  return (
    <div className="px-8 py-10">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">Working List</h1>
          <p className="mt-2 text-slate">What to work on this week — gaps, changes, nominations, obligations, and expiries.</p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro>A single prioritized list of action items computed on demand from your latest compliance snapshot, open nominations and obligations, and upcoming key expiries. Snooze or dismiss items; resolved items drop off automatically at the next snapshot.</PageIntro>
      <FilterPills />
      <div className="rounded-lg border border-slate/20 bg-white">
        {result.kind === 'error' ? (
          <div role="alert" className="p-12 text-center"><p className="text-red-900">Couldn&apos;t load the working list. The compliance service is temporarily unavailable.</p></div>
        ) : (
          <WorkingListTable items={result.data.items} total={result.data.total} />
        )}
      </div>
    </div>
  );
}
