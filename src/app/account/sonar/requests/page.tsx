import type { RequestManagementListResponse } from '@haiwave/protocol';
import { RequestManagementClient } from './request-management-client';
import { PageIntro } from '@/components/page-intro';
import { fetchBffJson } from '@/lib/server-fetch';

interface SearchParams {
  awaiting?: string;
  type?: string;
  counterparty?: string;
}

async function fetchList(sp: SearchParams) {
  const qs = new URLSearchParams({
    awaiting: sp.awaiting ?? 'me',
    type: sp.type ?? 'all',
    ...(sp.counterparty ? { counterparty: sp.counterparty } : {}),
  }).toString();
  // BFF path matches the Task 18 contract that the orchestrator + RequestRow
  // already use (`/api/sonar/compliance/requests`, no `/account/` prefix).
  return fetchBffJson<RequestManagementListResponse>(
    `/api/sonar/compliance/requests?${qs}`,
  );
}

interface PageProps {
  // Next.js 15+ App Router: searchParams is a Promise.
  searchParams: Promise<SearchParams>;
}

export default async function RequestManagementPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await fetchList(params);

  return (
    <div className="px-8 py-10">
      <header className="mb-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">
          Request Management
        </h1>
        <p className="mt-2 text-slate">
          Bilateral requests across your supply chain — accept inbound asks, chase outbound ones.
        </p>
      </header>
      <PageIntro>
        Two queues in one view: requests <em>awaiting you</em> (inbound nominations from customers
        and obligations you owe a response on) and requests <em>awaiting them</em> (outbound
        nominations you sent to vendors). Use the direction tabs above the list to flip between
        sides, the item-type pills to narrow to nominations or obligations, and the counterparty
        filter to focus on a single partner. Row actions (Accept / Decline / Withdraw) update the
        list immediately.
      </PageIntro>
      {result.kind === 'error' ? (
        <div role="alert" className="rounded-lg border border-slate/20 bg-white p-12 text-center">
          <p className="text-red-900">
            Couldn&apos;t load Request Management. The compliance service is temporarily
            unavailable.
          </p>
        </div>
      ) : (
        <RequestManagementClient initialData={result.data} />
      )}
    </div>
  );
}
