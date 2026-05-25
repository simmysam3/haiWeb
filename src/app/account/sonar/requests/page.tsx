import Link from 'next/link';
import type { RequestManagementListResponse } from '@haiwave/protocol';
import { RequestManagementClient } from './request-management-client';
import { PageIntro } from '@/components/page-intro';
import { fetchBffJson } from '@/lib/server-fetch';

/**
 * v.1.37 IA: filter state is URL-driven (FilterBar + DirectionTabs use
 * router.push to mutate searchParams). The page server-renders the initial
 * data with the URL params translated into the BFF contract, then hands off
 * to the client orchestrator which keeps subsequent fetches in sync via SWR.
 *
 * v.1.41: Declined absorbed into the direction tab strip (replaces the v1.35
 * `/account/sonar/requests/declined` sibling page). When `direction=declined`
 * the SSR fetch hits the declined endpoint instead of the active queue.
 */
interface SearchParams {
  direction?: string;
  // `awaiting` is the v1.35 alias still emitted by the legacy 301 redirects
  // (middleware.ts: /audit-nominations & /posture/nominations); accept both
  // names so old bookmarks continue to land correctly.
  awaiting?: string;
  item_type?: string;
  // Same legacy-alias pattern for `type`.
  type?: string;
  counterparty?: string;
  state?: string;
  age_bucket?: string;
}

function normalizeDirection(v: string | undefined): 'me' | 'them' | 'all' | 'declined' {
  return v === 'them' || v === 'all' || v === 'declined' ? v : 'me';
}

function normalizeItemType(v: string | undefined): 'nomination' | 'obligation' | 'all' {
  return v === 'nomination' || v === 'obligation' ? v : 'all';
}

async function fetchList(sp: SearchParams) {
  const direction = normalizeDirection(sp.direction ?? sp.awaiting);
  // Declined items come from a separate endpoint with its own query contract
  // (days=30 default; the legacy ?all=true escape hatch is no longer surfaced
  // in the unified UI but the BFF still accepts it).
  if (direction === 'declined') {
    return fetchBffJson<RequestManagementListResponse>(
      '/api/sonar/compliance/requests/declined?days=30',
    );
  }
  const qs = new URLSearchParams();
  qs.set('awaiting', direction);
  qs.set('type', normalizeItemType(sp.item_type ?? sp.type));
  if (sp.counterparty) qs.set('counterparty', sp.counterparty);
  if (sp.state) qs.set('state', sp.state);
  if (sp.age_bucket) qs.set('age_bucket', sp.age_bucket);
  // BFF path matches the Task 18 contract that the orchestrator + RequestRow
  // already use (`/api/sonar/compliance/requests`, no `/account/` prefix).
  return fetchBffJson<RequestManagementListResponse>(
    `/api/sonar/compliance/requests?${qs.toString()}`,
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
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-navy">
            Request Management
          </h1>
          <p className="mt-2 text-slate">
            Bilateral requests across your supply chain — accept inbound asks, chase outbound ones.
          </p>
        </div>
        <Link
          href="/account/sonar/requests/new-nomination"
          className="shrink-0 whitespace-nowrap rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
        >
          + New nomination
        </Link>
      </header>
      <PageIntro>
        Four queues in one view: <em>Awaiting me</em> (inbound nominations and outstanding
        obligations addressed to you), <em>Awaiting them</em> (outbound nominations you sent and
        downstream obligations you assigned), <em>All</em> (the full active backlog), and
        <em>Declined</em> (read-only audit trail of declined items from the last 30 days). Use the
        filter bar to narrow the active queues by item type, state, counterparty, or age. Row
        actions (Accept / Decline / Withdraw) update the list immediately.
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
