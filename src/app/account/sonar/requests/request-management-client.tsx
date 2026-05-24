'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import type { RequestManagementListResponse } from '@haiwave/protocol';
import { FetchError, jsonFetcher } from '@/lib/swr-fetcher';
import { DirectionTabs } from './direction-tabs';
import { RequestList } from './request-list';
import { FilterBar } from './_components/filter-bar';
import { EmptyFiltered } from './_components/empty-filtered';
import { DeclinedList } from './_components/declined-list';

/**
 * v.1.37 Request Management — client-side orchestrator.
 *
 * v.1.37 IA shift: filter state lives in URL searchParams (FilterBar +
 * DirectionTabs each own their own keys via `router.push`). The orchestrator
 * just reads the URL params, derives the BFF query string, and polls. The
 * deprecated item-type pills surface has been removed — item type is now
 * one of the four filters in the FilterBar.
 *
 * v.1.41: Declined absorbed into the direction tab strip. When direction is
 * `declined` the orchestrator polls the dedicated declined endpoint, renders
 * the read-only `DeclinedList` instead of `RequestList`, and skips the
 * FilterBar (declined view has no actionable filters today).
 *
 * `fallbackData` carries the server-rendered initial snapshot so the UI stays
 * populated through the first SWR fetch. Row-level mutations
 * (Accept/Decline/Withdraw inside `RequestRow`) call back through `onMutate`
 * to trigger an immediate revalidation rather than waiting for the next 30s
 * tick.
 */

interface Props {
  initialData: RequestManagementListResponse;
}

function mapItemTypeToLegacyParam(itemType: string | null): 'nomination' | 'obligation' | 'all' {
  if (itemType === 'nomination' || itemType === 'obligation') return itemType;
  return 'all';
}

function mapDirection(raw: string | null): 'me' | 'them' | 'all' | 'declined' {
  if (raw === 'them' || raw === 'all' || raw === 'declined') return raw;
  return 'me';
}

export function RequestManagementClient({ initialData }: Props) {
  const sp = useSearchParams();
  // Legacy aliases (`awaiting`, `type`) still arrive from the v1.35 301
  // redirects (middleware.ts) — accept either name, prefer the new one.
  const direction = mapDirection(sp.get('direction') ?? sp.get('awaiting'));
  const itemType = mapItemTypeToLegacyParam(sp.get('item_type') ?? sp.get('type'));
  const counterparty = sp.get('counterparty');
  const state = sp.get('state');
  const ageBucket = sp.get('age_bucket');
  const isDeclined = direction === 'declined';

  // Build the active-queue query string regardless of mode so memoization key
  // stays stable. When `direction=declined` the SWR key below targets the
  // declined endpoint instead and ignores this query string entirely.
  const activeQs = useMemo(() => {
    const out = new URLSearchParams();
    out.set('awaiting', isDeclined ? 'all' : direction);
    out.set('type', itemType);
    if (counterparty) out.set('counterparty', counterparty);
    if (state) out.set('state', state);
    if (ageBucket) out.set('age_bucket', ageBucket);
    return out.toString();
  }, [direction, itemType, counterparty, state, ageBucket, isDeclined]);

  const swrKey = isDeclined
    ? '/api/sonar/compliance/requests/declined?days=30'
    : `/api/sonar/compliance/requests?${activeQs}`;

  const { data, error, mutate } = useSWR<RequestManagementListResponse>(
    swrKey,
    jsonFetcher,
    {
      fallbackData: initialData,
      refreshInterval: 30_000,
    },
  );

  // Unfiltered fetch to populate the counterparty dropdown options. Without
  // this, the option set self-prunes once a counterparty is selected (the
  // filtered list only includes that counterparty's rows). Direction-tab
  // counts now come from the active fetch (the service computes them off
  // the non-direction-filtered scope so the tab badges line up with each
  // other and with the visible row count under the current filters). Always
  // hits the active-queue endpoint so the Declined tab still gets accurate
  // me/them/all badges.
  const { data: allData } = useSWR<RequestManagementListResponse>(
    '/api/sonar/compliance/requests?awaiting=all&type=all',
    jsonFetcher,
    { refreshInterval: 60_000 },
  );

  const items = data?.items ?? [];
  const isUnauthorized = error instanceof FetchError && error.status === 401;

  const counterpartyOptions = useMemo(() => {
    const source = allData?.items ?? data?.items ?? [];
    const byId = new Map<string, { id: string; label: string }>();
    for (const item of source) {
      if (byId.has(item.counterparty_id)) continue;
      const label = item.counterparty_legal_name ?? item.counterparty_id;
      byId.set(item.counterparty_id, { id: item.counterparty_id, label });
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
    );
  }, [allData, data]);

  // Detect "filters reduced the result set to zero" so the empty state can
  // show a Clear-filters CTA instead of the generic "no items" copy.
  // Declined view ignores filters today, so this gate only applies to the
  // active-queue modes.
  const filtersActive = Boolean(itemType !== 'all' || counterparty || state || ageBucket);
  const isEmptyFromFilters = !isDeclined && items.length === 0 && filtersActive;

  // Tab counts always source from the unfiltered active-queue feed so the
  // me/them/all chips stay populated even while viewing Declined.
  const meCount = isDeclined ? allData?.awaiting_me_count ?? 0 : data?.awaiting_me_count ?? 0;
  const themCount = isDeclined ? allData?.awaiting_them_count ?? 0 : data?.awaiting_them_count ?? 0;
  const totalCount = isDeclined ? allData?.total ?? 0 : data?.total ?? 0;

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-md border border-problem/20 bg-problem/5 px-3 py-2 text-sm text-problem"
        >
          {isUnauthorized ? (
            <>
              Session expired —{' '}
              <a href="/login" className="underline">
                sign in again
              </a>
              .
            </>
          ) : (
            <>
              Live updates paused — could not refresh queue.{' '}
              <button
                type="button"
                onClick={() => mutate()}
                className="underline"
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}
      <DirectionTabs
        awaitingMeCount={meCount}
        awaitingThemCount={themCount}
        totalCount={totalCount}
      />
      {isDeclined ? (
        <DeclinedList items={items} />
      ) : (
        <>
          <FilterBar counterpartyOptions={counterpartyOptions} />
          {isEmptyFromFilters ? (
            <EmptyFiltered />
          ) : (
            <RequestList items={items} onMutate={() => mutate()} />
          )}
        </>
      )}
    </div>
  );
}
