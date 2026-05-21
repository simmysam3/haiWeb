import type { WorkingListResponse } from '@haiwave/protocol';
import { WorkingListTable } from './working-list-table';
import { FilterPills } from './filter-pills';
import { RefreshButton } from '@/components/refresh-button';
import { PageIntro } from '@/components/page-intro';
import { fetchBffJson, type FetchResult } from '@/lib/server-fetch';

interface SearchParams { categories?: string; status?: string; sort?: string; partner_id?: string; sku?: string; }

async function fetchList(sp: SearchParams) {
  const qs = new URLSearchParams();
  if (sp.categories) qs.set('categories', sp.categories);
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
 * in `subject`, nomination/obligation items embed `sku_obligations.sku_label`.
 *
 * Match is case-insensitive and word-boundary-anchored against the SKU token in
 * `subject` so `?sku=PROD-1` doesn't collide with `PROD-10`/`PROD-12` in
 * zero-padded or sequential SKU schemes. Word boundary = any non-`[A-Za-z0-9_-]`
 * character (or start/end of string) on either side.
 *
 * Filter is intentionally client-side in HaiWeb: the haiCore feed has no SKU
 * filter param yet, and the search emitter (search/page.tsx data fetching) is
 * out of scope for this follow-up. Items without a SKU in `subject` (change,
 * expiry) will not match and are effectively excluded when `?sku=` is set —
 * that is the desired behavior.
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

export default async function WorkingListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sku = (params.sku ?? '').trim();
  const raw = await fetchList(params);
  const result = sku ? filterBySku(raw, sku) : raw;
  return (
    <div className="px-8 py-10">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display text-navy">Working List</h1>
          <p className="mt-2 text-slate">What to work on this week — gaps, changes, nominations, obligations, and expiries.</p>
        </div>
        <RefreshButton />
      </header>
      <PageIntro
        more={
          <>
            <p>
              <strong className="font-semibold text-navy">How to work the queue.</strong>{' '}
              Read the top of the list first — items are sorted by recency by default; switch to{' '}
              <em>oldest unresolved</em> when you want to clear stale gaps. For each item:
              click <strong>Open</strong> to jump to the underlying surface (the run that produced
              a gap, the partner record behind a nomination, etc.); <strong>Snooze</strong> to push
              an item out of the way for a week if you can&apos;t act on it now; <strong>Acknowledge
              &amp; suppress</strong> when you&apos;ve decided the item shouldn&apos;t recur in the
              queue and want to leave an audit-trail reason. Resolved items drop off automatically
              at the next snapshot — you don&apos;t need to mark them as such.
            </p>
            <p>
              <strong className="font-semibold text-navy">The five item types.</strong>
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">gap</span>{' '}
                — an open compliance gap surfaced by your latest audit snapshot. Resolve by running
                a fresh audit after the upstream evidence lands, or acknowledge if it&apos;s a
                known structural gap.
              </li>
              <li>
                <span className="rounded-full bg-teal/10 px-2 py-0.5 text-xs font-medium text-teal-dark">change</span>{' '}
                — a just-broken change event since the prior snapshot (origin shifted, lead time
                degraded, cert expired, etc.). Treat as an alert; open the Changes feed for
                before/after detail.
              </li>
              <li>
                <span className="rounded-full bg-slate/15 px-2 py-0.5 text-xs font-medium text-slate">nomination</span>{' '}
                — a vendor audit you nominated; you&apos;re waiting on them. No action from you
                until they respond.
              </li>
              <li>
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">obligation</span>{' '}
                — a customer-initiated request you owe a response to. Open it from this row to
                file the response.
              </li>
              <li>
                <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">expiry</span>{' '}
                — a provenance key approaching its expiry window. Rotate or renew the key before
                it expires to avoid a coverage gap.
              </li>
            </ul>
            <p>
              <strong className="font-semibold text-navy">Reading the filter pills.</strong>{' '}
              The <em>Category</em> row above the table toggles which item types you see — hover a
              pill to see what each type means. The <em>Status</em> dropdown narrows by lifecycle:
              <em> open</em> (active), <em>snoozed</em> (will re-surface), or{' '}
              <em>dismissed</em> (suppressed with a reason). Suppressed items are hidden by
              default on the table itself; toggle &quot;Show suppressed&quot; on the table to see
              what was acknowledged + why.
            </p>
          </>
        }
      >
        A single prioritized list of action items computed on demand from your latest compliance snapshot, open nominations and obligations, and upcoming key expiries. Snooze or dismiss items; resolved items drop off automatically at the next snapshot.
      </PageIntro>
      <FilterPills />
      <div className="rounded-lg border border-slate/20 bg-white">
        {result.kind === 'error' ? (
          <div role="alert" className="p-12 text-center"><p className="text-red-900">Couldn&apos;t load the working list. The compliance service is temporarily unavailable.</p></div>
        ) : (
          <WorkingListTable items={result.data.items} total={result.data.total} />
        )}
      </div>
    </div>
  );
}
