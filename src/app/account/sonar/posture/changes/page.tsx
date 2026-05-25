import type { ComplianceChangeFeedResponse } from '@haiwave/protocol';
import { ChangesFeed } from './changes-feed';
import { FilterPills } from './filter-pills';
import { DEFAULT_SEVERITY, SEVERITY_VALUES } from './_lib/severity';
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
  severity?: string;
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

  // Severity defaults to `critical` (v.1.41 "Showing" dropdown default).
  // `all` collapses to no filter on the wire — haiCore returns every severity
  // when severity is omitted. An unknown value falls back to the default so a
  // stale URL never bypasses the filter silently.
  const rawSeverity = searchParams.severity;
  const severity = rawSeverity && SEVERITY_VALUES.has(rawSeverity) ? rawSeverity : DEFAULT_SEVERITY;
  if (severity !== 'all') sp.set('severity', severity);

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
            Consequential supply-chain changes detected between snapshots — default window is 14 days.
          </p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro>
        A reverse-chronological alerting feed of consequential changes detected between snapshots: origin shifts, certification expirations and renewals, vendor substitutions, lead-time degradation, depth changes, and similar. Gap openings and closures are tracked separately on the <em>Gaps</em> tab (they describe a gap&apos;s own lifecycle, not an external event). Filter by event kind, partner, or date range. Click Review on any row to view the before-and-after cell detail.
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
