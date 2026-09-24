'use client';
import { useState } from 'react';
import useSWR from 'swr';
import type { SmExecutionDetail, SmExecutionStatusResponse } from '@/lib/sourcing-map/contract';
import { jsonFetcher } from '@/lib/swr-fetcher';
import { SM_POLL_MS } from '@/lib/sourcing-map/map/selectors';

const LIVE = new Set(['queued', 'running']);

interface PollState {
  /** the `initial` this state started from; a different one restarts it (R1) */
  from: SmExecutionDetail | null;
  detail: SmExecutionDetail | null;
  cursor: number;
}

function startFrom(initial: SmExecutionDetail | null): PollState {
  return { from: initial, detail: initial, cursor: initial?.execution.probes_done ?? 0 };
}

/**
 * Progressive results (spec §8.9): poll the status with ?cursor= every 1.5 s
 * while queued/running — the run-detail-shell.tsx:24-28 pattern — and stop
 * (null key) once the execution is terminal. dedupingInterval 0: SWR's default
 * 2 s window would swallow every other 1.5 s tick (D8).
 *
 * `initial` must be referentially stable (state, not a fresh object each
 * render): a new `initial` restarts the poll from it.
 */
export function useExecutionPoll(initial: SmExecutionDetail | null): { detail: SmExecutionDetail | null } {
  const [state, setState] = useState(() => startFrom(initial));
  // R1: adjust state during render when `initial` changes (no setState in an effect).
  if (state.from !== initial) setState(startFrom(initial));
  const { detail, cursor } = state;
  const live = detail !== null && LIVE.has(detail.execution.status);
  useSWR<SmExecutionStatusResponse>(
    live ? `/api/account/sourcing-map/executions/${detail!.execution.execution_id}/status?cursor=${cursor}` : null,
    jsonFetcher,
    { refreshInterval: SM_POLL_MS, dedupingInterval: 0 },
  );
  return { detail };
}
