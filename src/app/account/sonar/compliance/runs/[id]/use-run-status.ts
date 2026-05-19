'use client';

import useSWR from 'swr';
import type { RunStatus, RunStatusResponse } from '@haiwave/protocol';
import { jsonFetcher } from '@/lib/swr-fetcher';

const TERMINAL: RunStatus[] = ['complete', 'partial', 'failed', 'cancelled'];

export interface UseRunStatusReturn {
  status: RunStatus | undefined;
  hopCount: number | null | undefined;
  gapCount: number | null | undefined;
  resultsAvailableCount: number | undefined;
  isLoading: boolean;
  error: Error | undefined;
  mutate: () => Promise<RunStatusResponse | undefined>;
}

/**
 * Subscribes to GET /api/account/audit-runs/:id/status with deduped
 * polling. Section 13.2.1: 10s baseline while running; 0 (stop) once
 * terminal.
 */
export function useRunStatus(runId: string): UseRunStatusReturn {
  const { data, error, isLoading, mutate } = useSWR<RunStatusResponse>(
    runId ? `/api/account/audit-runs/${runId}/status` : null,
    jsonFetcher,
    {
      // Per-tick: if the latest data shows a terminal state, set
      // refreshInterval to 0 (stop). Otherwise 10s (Section 13.2.1).
      refreshInterval: (latest) =>
        latest && TERMINAL.includes(latest.status) ? 0 : 10_000,
      revalidateOnFocus: true,
      dedupingInterval: 5_000,
    },
  );

  return {
    status: data?.status,
    hopCount: data?.hop_count,
    gapCount: data?.gap_count,
    resultsAvailableCount: data?.results_available_count,
    isLoading,
    error,
    mutate: () => mutate(),
  };
}
