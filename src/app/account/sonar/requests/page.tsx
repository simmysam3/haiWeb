import Link from 'next/link';
import type { RequestManagementListResponse } from '@haiwave/protocol';
import { RequestManagementClient } from './request-management-client';
import { PageIntro } from '@/components/page-intro';
import { PageHeader } from '@/components';
import { fetchBffJson } from '@/lib/server-fetch';
import { buildRequestQueuePath, normalizeDirection, normalizeItemType } from './_lib/build-request-queue-path';

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

async function fetchList(sp: SearchParams) {
  const direction = normalizeDirection(sp.direction, sp.awaiting);
  const itemType = normalizeItemType(sp.item_type, sp.type);
  const path = buildRequestQueuePath(direction, itemType, {
    counterparty: sp.counterparty,
    state: sp.state,
    ageBucket: sp.age_bucket,
  });
  return fetchBffJson<RequestManagementListResponse>(path);
}

interface PageProps {
  // Next.js 15+ App Router: searchParams is a Promise.
  searchParams: Promise<SearchParams>;
}

export default async function RequestManagementPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await fetchList(params);

  return (
    <div>
      <PageHeader
        title="Request Management"
        description="Bilateral requests across your supply chain — accept inbound asks, chase outbound ones."
        actions={
          <Link
            href="/account/sonar/requests/new-nomination"
            className="shrink-0 whitespace-nowrap rounded bg-teal text-white px-3 py-1.5 text-sm font-medium hover:bg-teal/90"
          >
            + New nomination
          </Link>
        }
      />
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
