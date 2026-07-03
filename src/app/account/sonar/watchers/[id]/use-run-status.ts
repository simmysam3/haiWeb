'use client';

import useSWR from 'swr';
import type { WatcherRunStatus } from '@haiwave/protocol';
import { jsonFetcher } from '@/lib/swr-fetcher';

export const TERMINAL: WatcherRunStatus[] = ['complete', 'partial', 'failed', 'cancelled'];

interface WatcherRunStatusResponse {
  status: WatcherRunStatus;
}

export interface UseRunStatusReturn {
  status: WatcherRunStatus | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => Promise<WatcherRunStatusResponse | undefined>;
}

/**
 * Subscribes to GET /api/account/sonar/watcher/runs/:id/status with deduped
 * polling. 10s baseline while running; stops once terminal.
 *
 * v.1.43 watcher-rebuild Task 21: rewired from audit-runs to watcher endpoints.
 * The watcher status payload is intentionally minimal (`{ status }`) — hop /
 * gap / results counts were audit-specific and have no analogue on
 * WatcherRun.
 */
export function useRunStatus(runId: string): UseRunStatusReturn {
  const { data, error, isLoading, mutate } = useSWR<WatcherRunStatusResponse>(
    runId ? `/api/account/sonar/watcher/runs/${runId}/status` : null,
    jsonFetcher,
    {
      refreshInterval: (latest) =>
        latest && TERMINAL.includes(latest.status) ? 0 : 10_000,
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
    },
  );

  return {
    status: data?.status,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}
