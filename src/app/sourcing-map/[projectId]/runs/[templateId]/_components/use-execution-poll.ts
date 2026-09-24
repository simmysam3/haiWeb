'use client';
import { useState } from 'react';
import useSWR from 'swr';
import type { SmExecutionDetail, SmExecutionStatusResponse } from '@/lib/sourcing-map/contract';
import { FetchError, jsonFetcher } from '@/lib/swr-fetcher';
import { smFetch } from '@/lib/sourcing-map/client';
import { SM_POLL_MS, applyStatusDelta } from '@/lib/sourcing-map/map/selectors';

const LIVE = new Set(['queued', 'running']);

interface PollState {
  /** the `initial` this state started from; a different one restarts it (R1) */
  from: SmExecutionDetail | null;
  detail: SmExecutionDetail | null;
  cursor: number;
  /** a-G4 / R2: a failure the workspace shows; never jsonFetcher's own message (it holds an internal URL) */
  error: string | null;
}

/** R2: the HTTP status when there is one (a network drop has none); never the fetcher's message. */
function pollErrorText(e: unknown): string {
  return e instanceof FetchError ? `Progress could not be refreshed (${e.status}). Retrying.` : 'Progress could not be refreshed. Retrying.';
}

function startFrom(initial: SmExecutionDetail | null): PollState {
  return { from: initial, detail: initial, cursor: initial?.execution.probes_done ?? 0, error: null };
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
export function useExecutionPoll(initial: SmExecutionDetail | null): { detail: SmExecutionDetail | null; error: string | null } {
  const [state, setState] = useState(() => startFrom(initial));
  // R1: adjust state during render when `initial` changes (no setState in an effect).
  if (state.from !== initial) setState(startFrom(initial));
  const { detail, cursor } = state;
  /** R3: an answer applies only while its execution is still the current one. */
  const forExecution = (executionId: string, change: (st: PollState, d: SmExecutionDetail) => PollState) =>
    setState((st) => (st.detail !== null && st.detail.execution.execution_id === executionId ? change(st, st.detail) : st));
  const live = detail !== null && LIVE.has(detail.execution.status);
  useSWR<SmExecutionStatusResponse>(
    live ? `/api/account/sourcing-map/executions/${detail!.execution.execution_id}/status?cursor=${cursor}` : null,
    jsonFetcher,
    {
      refreshInterval: SM_POLL_MS,
      dedupingInterval: 0,
      onSuccess: (s) => {
        forExecution(s.execution_id, (st, d) => ({
          ...st,
          cursor: s.cursor,
          error: null,
          detail: {
            execution: { ...d.execution, status: s.status, failure_reason: s.failure_reason, probes_planned: s.probes_planned, probes_done: s.probes_done },
            result: d.result ? applyStatusDelta(d.result, s) : d.result,
          },
        }));
        if (!LIVE.has(s.status)) {
          void smFetch<SmExecutionDetail>(`/api/account/sourcing-map/executions/${s.execution_id}`).then((out) => {
            forExecution(s.execution_id, (st) => (out.ok ? { ...st, detail: out.data } : { ...st, error: out.message }));
          });
        }
      },
      onError: (e: unknown) => {
        setState((st) => ({ ...st, error: pollErrorText(e) }));
      },
    },
  );
  return { detail, error: state.error };
}
