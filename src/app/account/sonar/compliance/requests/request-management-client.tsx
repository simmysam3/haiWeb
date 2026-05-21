'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { RequestManagementListResponse } from '@haiwave/protocol';
import { FetchError, jsonFetcher } from '@/lib/swr-fetcher';
import { DirectionTabs, type DirectionTabValue } from './direction-tabs';
import { ItemTypePills, type ItemTypePillValue } from './item-type-pills';
import { CounterpartyFilter } from './counterparty-filter';
import { RequestList } from './request-list';

/**
 * v1.35 Request Management — client-side orchestrator.
 *
 * Owns the three filter dimensions (direction / item-type / counterparty),
 * builds the BFF query string, and polls `/api/sonar/compliance/requests`
 * every 30s via SWR. The four child components (`DirectionTabs`,
 * `ItemTypePills`, `CounterpartyFilter`, `RequestList`) are presentational —
 * state is owned here and threaded back down via props.
 *
 * `fallbackData` carries the server-rendered initial snapshot so the UI
 * stays populated even if the SWR fetch fails (e.g. before Task 18 wires
 * the BFF endpoint). Row-level mutations (Accept/Decline/Withdraw inside
 * `RequestRow`) call back through `onMutate` to trigger an immediate
 * revalidation rather than waiting for the next 30s tick.
 */

interface Props {
  initialData: RequestManagementListResponse;
}

export function RequestManagementClient({ initialData }: Props) {
  const [direction, setDirection] = useState<DirectionTabValue>('me');
  const [itemType, setItemType] = useState<ItemTypePillValue>('all');
  const [counterparty, setCounterparty] = useState<string | null>(null);

  const qs = new URLSearchParams({
    awaiting: direction,
    type: itemType,
    ...(counterparty ? { counterparty } : {}),
  }).toString();

  const { data, error, mutate } = useSWR<RequestManagementListResponse>(
    `/api/sonar/compliance/requests?${qs}`,
    jsonFetcher,
    {
      fallbackData: initialData,
      refreshInterval: 30_000,
    },
  );

  // Unfiltered fetch to populate the CounterpartyFilter dropdown options.
  // Without this, the dropdown's option set self-prunes once a counterparty
  // is selected (because the BFF returns only that counterparty's rows),
  // making it impossible to switch directly between counterparties. Slower
  // poll: the set of counterparties changes infrequently. Errors are
  // deliberately not surfaced — a missing/stale dropdown option set is
  // tolerable; falling back to filtered items preserves the prior behavior.
  const { data: allData } = useSWR<RequestManagementListResponse>(
    '/api/sonar/compliance/requests?awaiting=all&type=all',
    jsonFetcher,
    { refreshInterval: 60_000 },
  );

  const items = data?.items ?? [];
  const allCounterpartyOptions = allData?.items ?? data?.items ?? [];
  const isUnauthorized = error instanceof FetchError && error.status === 401;

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
        value={direction}
        onChange={setDirection}
        awaitingMeCount={data?.awaiting_me_count ?? 0}
        awaitingThemCount={data?.awaiting_them_count ?? 0}
        totalCount={data?.total ?? 0}
      />
      <div className="flex flex-wrap gap-4">
        <ItemTypePills value={itemType} onChange={setItemType} />
        <CounterpartyFilter
          items={allCounterpartyOptions}
          value={counterparty}
          onChange={setCounterparty}
        />
      </div>
      <RequestList items={items} onMutate={() => mutate()} />
    </div>
  );
}
