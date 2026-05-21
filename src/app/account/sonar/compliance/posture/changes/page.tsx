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
          <h1 className="text-3xl font-display text-navy">Changes</h1>
          <p className="mt-2 text-slate">
            Compliance changes detected between snapshots — default window is 14 days.
          </p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro>
        A reverse-chronological feed of every change detected between compliance snapshots: origin shifts, gap openings and closures, certification expirations, vendor substitutions, and more. Filter by change kind, partner, or date range. Click Compare on any row to view the before-and-after cell detail.
      </PageIntro>

      <FilterPills />

      <div className="rounded-lg border border-slate/20 bg-white">
        {result.kind === 'error' ? (
          <div role="alert" className="p-12 text-center">
            <p className="text-red-900">
              {result.status === 403
                ? "You do not have permission to view compliance changes."
                : result.status === 401
                ? "Your session has expired. Please sign in again."
                : result.status >= 500
                ? "Couldn’t load compliance changes. The audit service is temporarily unavailable."
                : result.status === 0
                ? `Couldn’t reach the audit service${result.message ? `: ${result.message}` : "."}`
                : `Couldn’t load compliance changes (status ${result.status}).`}
            </p>
          </div>
        ) : (
          <ChangesFeed changes={result.data.changes} total={result.data.total} />
        )}
      </div>
    </div>
  );
}
