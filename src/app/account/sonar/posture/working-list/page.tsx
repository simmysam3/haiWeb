import type { WorkingListResponse } from '@haiwave/protocol';
import { WorkingListTable } from './working-list-table';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';
import { fetchBffJson, type FetchResult } from '@/lib/server-fetch';

interface SearchParams { status?: string; sort?: string; partner_id?: string; sku?: string; }

/**
 * v.1.41 Backlog IA — Gaps mode. The /sonar/posture/working-list URL
 * stays canonical but is now hard-scoped to `category=gap`. Cross-
 * category items (change/nomination/obligation/expiry) live in their
 * own modes (Events / Obligations / etc.) so the section's three tabs
 * each show one item-type only — no unified mashup.
 *
 * A `?categories=...` query param from a legacy bookmark is silently
 * ignored. PR-6 adds the trending header strip ("342 open gaps · ↓ 68
 * vs last week") that contextualises the page beyond a flat list.
 */
async function fetchList(sp: SearchParams) {
  const qs = new URLSearchParams();
  qs.set('categories', 'gap');
  if (sp.status) qs.set('status', sp.status);
  if (sp.sort) qs.set('sort', sp.sort);
  if (sp.partner_id) qs.set('partner_id', sp.partner_id);
  return fetchBffJson<WorkingListResponse>(
    `/api/account/sonar/compliance/working-list?${qs}`,
  );
}

/**
 * Filter a working-list payload to items matching a SKU identifier. Used to honor
 * the `?sku=` deep-link emitted by global search (v1.37). `WorkingListItem` has
 * no dedicated product_id field — gap items embed `auditRunResults.productId`
 * in `subject`.
 *
 * Match is case-insensitive and word-boundary-anchored against the SKU token in
 * `subject` so `?sku=PROD-1` doesn't collide with `PROD-10`/`PROD-12` in
 * zero-padded or sequential SKU schemes. Word boundary = any non-`[A-Za-z0-9_-]`
 * character (or start/end of string) on either side.
 *
 * Filter is intentionally client-side in HaiWeb: the haiCore feed has no SKU
 * filter param yet, and the search emitter (search/page.tsx data fetching) is
 * out of scope for this follow-up.
 */
export function filterBySku(
  result: FetchResult<WorkingListResponse>,
  sku: string,
): FetchResult<WorkingListResponse> {
  if (result.kind !== 'ok' || !sku) return result;
  const needle = sku.trim();
  if (!needle) return result;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[^A-Za-z0-9_-])${escaped}(?:[^A-Za-z0-9_-]|$)`, 'i');
  const filtered = result.data.items.filter((it) => re.test(it.subject));
  return { ...result, data: { items: filtered, total: filtered.length } };
}

interface PageProps { searchParams: Promise<SearchParams>; }

export default async function GapsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sku = (params.sku ?? '').trim();
  const raw = await fetchList(params);
  const result = sku ? filterBySku(raw, sku) : raw;
  return (
    <div className="px-8 py-10">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">Gaps</h1>
          <p className="mt-2 text-slate">
            Open compliance gaps from your latest snapshot — sub-tier blanks, missing
            evidence, observability holes. Resolve by running a fresh check once
            upstream evidence lands, or acknowledge if it&apos;s a known structural gap.
          </p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro
        more={
          <>
            <p>
              <strong className="font-semibold text-navy">How to work the queue.</strong>{' '}
              Items sort by recency by default; switch to <em>oldest unresolved</em> to
              clear stale gaps. For each item: click <strong>Open</strong> to jump to the
              underlying audit run; <strong>Snooze</strong> to push an item out of the way
              for a week when you can&apos;t act now; <strong>Acknowledge &amp; suppress</strong>
              {' '}to remove a gap permanently with a recorded reason. Resolved gaps drop
              off automatically at the next snapshot — you don&apos;t need to mark them.
            </p>
            <p>
              <strong className="font-semibold text-navy">Why this list is long.</strong>{' '}
              Most BOM breakouts surface hundreds of gaps — that&apos;s the cost of
              observability, not a signal of poor compliance. The actionable view is the
              <em> trend</em>: is your gap count falling week-over-week? PR-6 will add a
              gap-count trend strip at the top of this page so you can see direction at
              a glance.
            </p>
          </>
        }
      >
        Snooze or dismiss items that aren&apos;t actionable right now; resolved items
        drop off automatically at the next snapshot.
      </PageIntro>
      <FilterPills />
      <div className="rounded-lg border border-slate/20 bg-white">
        {result.kind === 'error' ? (
          <div role="alert" className="p-12 text-center"><p className="text-red-900">Couldn&apos;t load gaps. The compliance service is temporarily unavailable.</p></div>
        ) : (
          <WorkingListTable items={result.data.items} total={result.data.total} />
        )}
      </div>
    </div>
  );
}
