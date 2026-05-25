import type { ComplianceChangeFeedResponse } from '@haiwave/protocol';
import { ChangesFeed } from './changes-feed';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';
import { fetchBffJson } from '@/lib/server-fetch';

interface SearchParams {
  kind?: string | string[];
  partner?: string;
  from?: string;
  to?: string;
}

async function fetchChanges(searchParams: SearchParams) {
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

  return fetchBffJson<ComplianceChangeFeedResponse>(
    `/api/account/sonar/compliance/changes?${sp}`,
  );
}

interface PageProps {
  searchParams: Promise<SearchParams>;
}

export default async function ChangesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const result = await fetchChanges(params);

  return (
    <div className="px-8 py-10">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">Events</h1>
          <p className="mt-2 text-slate">
            Consequential supply-chain changes detected between snapshots — default window is 14 days.
          </p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro>
        A reverse-chronological alerting feed of consequential changes detected between snapshots: origin shifts, certification expirations and renewals, vendor substitutions, lead-time degradation, depth changes, and similar. Gap openings and closures are tracked separately on the <em>Gaps</em> tab (they describe a gap&apos;s own lifecycle, not an external event). Filter by event kind, partner, or date range. Click Compare on any row to view the before-and-after cell detail.
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
          <ChangesFeed changes={result.data.changes} total={result.data.total} />
        )}
      </div>
    </div>
  );
}
