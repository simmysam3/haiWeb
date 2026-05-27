import type { ComplianceChangeFeedResponse } from '@haiwave/protocol';
import { ChangesFeed } from './changes-feed';
import { FilterPills } from './filter-pills';
import { DEFAULT_SEVERITY, SEVERITY_VALUES } from './_lib/severity';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';
import { PageHeader } from '@/components';
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
  processed?: string;
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

  // `processed=true` is the v.1.42 "Showing: Processed" view-mode — it short-
  // circuits the severity filter (the dropdown selection is mutually
  // exclusive at the UI). Anything else falls through to the severity flow.
  const isProcessedView = searchParams.processed === 'true';
  if (isProcessedView) {
    sp.set('processed', 'true');
  } else {
    // Severity defaults to `critical` (v.1.41 "Showing" dropdown default).
    // `all` collapses to no filter on the wire — haiCore returns every
    // severity when severity is omitted. An unknown value falls back to the
    // default so a stale URL never bypasses the filter silently.
    const rawSeverity = searchParams.severity;
    const severity =
      rawSeverity && SEVERITY_VALUES.has(rawSeverity)
        ? rawSeverity
        : DEFAULT_SEVERITY;
    if (severity !== 'all' && severity !== 'processed') {
      sp.set('severity', severity);
    }
  }

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
    <div>
      <PageHeader
        title="Events"
        description="Consequential supply-chain changes detected between snapshots — default window is 14 days."
        actions={<RefreshButton />}
      />
      <PageIntro>
        Drift events from your scheduled watcher and audit configurations. Default view shows critical-only — change the Showing dropdown to see warnings, info, or processed items. Process an event to record an outcome and drop it from the active backlog.
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
