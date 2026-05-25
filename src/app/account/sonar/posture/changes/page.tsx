import type { ComplianceChangeFeedResponse } from '@haiwave/protocol';
import { ChangesFeed } from './changes-feed';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';
import { fetchBffJson } from '@/lib/server-fetch';

/**
 * Events feed page size. 25 rows fits in one viewport without overwhelming the
 * eye and keeps the pager footprint small enough to stay above the fold for
 * normal totals. Backed by `?page=` URL param (1-indexed) so the active page
 * survives reloads and is shareable.
 */
const PAGE_SIZE = 25;

interface SearchParams {
  kind?: string | string[];
  partner?: string;
  from?: string;
  to?: string;
  page?: string;
}

async function fetchChanges(searchParams: SearchParams, offset: number) {
  const sp = new URLSearchParams();
  const kinds = searchParams.kind;
  if (Array.isArray(kinds)) {
    kinds.forEach((k) => sp.append('kind', k));
  } else if (kinds) {
    sp.append('kind', kinds);
  }
  if (searchParams.partner) sp.set('partner', searchParams.partner);
  if (searchParams.from) sp.set('from', searchParams.from);
  if (searchParams.to) sp.set('to', searchParams.to);
  sp.set('limit', String(PAGE_SIZE));
  sp.set('offset', String(offset));

  return fetchBffJson<ComplianceChangeFeedResponse>(
    `/api/account/sonar/compliance/changes?${sp}`,
  );
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ChangesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const pageParam = Math.max(parseInt(params.page ?? '1', 10) || 1, 1);
  const offset = (pageParam - 1) * PAGE_SIZE;
  const result = await fetchChanges(params, offset);

  return (
    <div className="px-8 py-10">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">Events</h1>
          <p className="mt-2 text-slate">
            Monitoring events detected between snapshots — default window is 14 days.
          </p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro>
        A reverse-chronological alerting feed of every change detected between snapshots: origin shifts, gap openings and closures, certification expirations, vendor substitutions, and more. Filter by event kind, partner, or date range. Click Compare on any row to view the before-and-after cell detail.
      </PageIntro>

      <FilterPills />

      <div className="rounded-lg border border-slate/20 bg-white">
        {result.kind === 'error' ? (
          <div role="alert" className="p-12 text-center">
            <p className="text-red-900">
              {result.status === 403
                ? "You do not have permission to view events."
                : result.status === 401
                ? "Your session has expired. Please sign in again."
                : result.status >= 500
                ? "Couldn’t load events. The monitoring service is temporarily unavailable."
                : result.status === 0
                ? `Couldn’t reach the monitoring service${result.message ? `: ${result.message}` : "."}`
                : `Couldn’t load events (status ${result.status}).`}
            </p>
          </div>
        ) : (
          <ChangesFeed
            changes={result.data.changes}
            total={result.data.total}
            page={pageParam}
            pageSize={PAGE_SIZE}
          />
        )}
      </div>
    </div>
  );
}
