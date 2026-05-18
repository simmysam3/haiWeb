'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RunStatus } from '@haiwave/protocol';
import { useRunStatus } from './use-run-status';
import { Pill } from '@/components/pill';

const TERMINAL: RunStatus[] = ['complete', 'partial', 'failed', 'cancelled'];

interface RunControlsProps {
  runId: string;
  initialStatus: RunStatus;
  initialHopCount: number | null;
  initialGapCount: number | null;
  initialResultsCount: number;
  errorMessage?: string | null;
}

export function RunControls({
  runId,
  initialStatus,
  initialHopCount,
  initialGapCount,
  initialResultsCount,
  errorMessage,
}: RunControlsProps) {
  const router = useRouter();
  const { status, hopCount, gapCount, resultsAvailableCount, error, mutate } =
    useRunStatus(runId);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const effectiveStatus = status ?? initialStatus;
  // Use === undefined (not ??) so a fresh `null` from the API isn't masked
  // by a stale SSR value. `undefined` means "hook hasn't resolved its first
  // poll yet" → fall back to SSR. `null` means "API says no value yet" and
  // must propagate so the counter line below omits hops/gaps.
  const effectiveHop = hopCount === undefined ? initialHopCount : hopCount;
  const effectiveGap = gapCount === undefined ? initialGapCount : gapCount;
  const effectiveResults = resultsAvailableCount ?? initialResultsCount;

  // When status transitions out of running, refresh server data so the
  // products grid (rendered by the parent SSR) re-fetches its results.
  // Section 13.2.1 item 2 — cache invalidation on terminal state.
  // Guarded by `wasNonTerminal` so SSR mounts of already-terminal runs
  // don't fire a wasted RSC round-trip — only real running → terminal
  // transitions during the client session trigger the refresh.
  const isTerminal = TERMINAL.includes(effectiveStatus);
  const wasNonTerminal = useRef(!TERMINAL.includes(initialStatus));
  useEffect(() => {
    if (isTerminal && wasNonTerminal.current) {
      wasNonTerminal.current = false;
      router.refresh();
    }
  }, [isTerminal, router]);

  // If the worker has actually transitioned out of running, drop the
  // local cancelling indicator (the polled status now reflects truth).
  useEffect(() => {
    if (cancelling && isTerminal) {
      setCancelling(false);
    }
  }, [cancelling, isTerminal]);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/account/audit-runs/${runId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Cancel failed: ${res.status}`);
      }
      // Section 13.2.1 item 6 — one-shot 500ms-delayed reconciliation.
      setTimeout(() => {
        void mutate();
      }, 500);
    } catch (err) {
      setCancelling(false);
      setCancelError(err instanceof Error ? err.message : 'Cancel failed');
    }
  }

  return (
    <div className="flex items-center gap-4">
      <StatusPill status={effectiveStatus} cancelling={cancelling} errorMessage={errorMessage} />
      <div className="text-sm text-slate">
        {effectiveResults} {effectiveResults === 1 ? 'result' : 'results'}
        {effectiveHop !== null ? ` · ${effectiveHop} hops` : ''}
        {effectiveGap !== null ? ` · ${effectiveGap} gaps` : ''}
      </div>
      {effectiveStatus === 'running' && !cancelling && (
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm px-3 py-1 rounded border border-slate/20 text-charcoal hover:bg-light-gray transition-colors"
        >
          Cancel
        </button>
      )}
      {error && (
        <span className="text-xs text-problem">Status fetch failed</span>
      )}
      {cancelError && (
        <span className="text-xs text-problem">{cancelError}</span>
      )}
    </div>
  );
}

function StatusPill({
  status,
  cancelling,
  errorMessage,
}: {
  status: RunStatus;
  cancelling: boolean;
  errorMessage?: string | null;
}) {
  if (cancelling && status === 'running') {
    return (
      <span className="text-sm text-slate">
        Cancelling
        <AnimatedDots />
      </span>
    );
  }
  const label =
    status === 'running' ? 'Running' :
    status === 'complete' ? 'Complete' :
    status === 'partial' ? 'Partial' :
    status === 'failed' ? 'Failed' :
    'Cancelled';
  return (
    <Pill
      category="run_status"
      value={status}
      detail={status === 'failed' ? errorMessage ?? undefined : undefined}
    >
      {label}
    </Pill>
  );
}

function AnimatedDots() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 400);
    return () => clearInterval(id);
  }, []);
  return <span aria-hidden>{'.'.repeat(tick)}</span>;
}
