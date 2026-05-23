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

/**
 * v.1.37 Request Management — client-side orchestrator.
 *
 * v.1.37 IA shift: filter state lives in URL searchParams (FilterBar +
 * DirectionTabs each own their own keys via `router.push`). The orchestrator
 * just reads the URL params, derives the BFF query string, and polls. The
 * deprecated item-type pills surface has been removed — item type is now
 * one of the four filters in the FilterBar.
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

function mapDirection(raw: string | null): 'me' | 'them' | 'all' {
  if (raw === 'them' || raw === 'all') return raw;
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

  const qs = useMemo(() => {
    const out = new URLSearchParams();
    out.set('awaiting', direction);
    out.set('type', itemType);
    if (counterparty) out.set('counterparty', counterparty);
    if (state) out.set('state', state);
    if (ageBucket) out.set('age_bucket', ageBucket);
    return out.toString();
  }, [direction, itemType, counterparty, state, ageBucket]);

  const { data, error, mutate } = useSWR<RequestManagementListResponse>(
    `/api/sonar/compliance/requests?${qs}`,
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
  // other and with the visible row count under the current filters).
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
  const filtersActive = Boolean(itemType !== 'all' || counterparty || state || ageBucket);
  const isEmptyFromFilters = items.length === 0 && filtersActive;

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
        awaitingMeCount={data?.awaiting_me_count ?? 0}
        awaitingThemCount={data?.awaiting_them_count ?? 0}
        totalCount={data?.total ?? 0}
      />
      <FilterBar counterpartyOptions={counterpartyOptions} />
      {isEmptyFromFilters ? (
        <EmptyFiltered />
      ) : (
        <RequestList items={items} onMutate={() => mutate()} />
      )}
    </div>
  );
}
