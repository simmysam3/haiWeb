import { headers } from 'next/headers';
import type { ComplianceChangeFeedResponse } from '@haiwave/protocol';
import { ChangesFeed } from './changes-feed';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';

interface SearchParams {
  kind?: string | string[];
  partner?: string;
  from?: string;
  to?: string;
}

type FetchResult =
  | { kind: 'ok'; data: ComplianceChangeFeedResponse }
  | { kind: 'error'; status: number; message?: string };

async function fetchChanges(searchParams: SearchParams): Promise<FetchResult> {
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

  const h = await headers();
  const cookie = h.get('cookie') ?? '';
  const protocol = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? 'localhost:3000';
  const url = `${protocol}://${host}/api/account/sonar/compliance/changes?${sp}`;
  try {
    const res = await fetch(url, { headers: { cookie }, cache: 'no-store' });
    if (!res.ok) return { kind: 'error', status: res.status };
    return { kind: 'ok', data: (await res.json()) as ComplianceChangeFeedResponse };
  } catch (e) {
    console.error('[changes/page] fetch threw:', e);
    return {
      kind: 'error',
      status: 0,
      message: e instanceof Error ? e.message : String(e),
    };
  }
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
