'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RunStatus } from '@haiwave/protocol';
import { useRunStatus } from './use-run-status';

const TERMINAL: RunStatus[] = ['complete', 'partial', 'failed', 'cancelled'];

interface RunControlsProps {
  runId: string;
  initialStatus: RunStatus;
  initialHopCount: number | null;
  initialGapCount: number | null;
  initialResultsCount: number;
}

export function RunControls({
  runId,
  initialStatus,
  initialHopCount,
  initialGapCount,
  initialResultsCount,
}: RunControlsProps) {
  const router = useRouter();
  const { status, hopCount, gapCount, resultsAvailableCount, error, mutate } =
    useRunStatus(runId);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const effectiveStatus = status ?? initialStatus;
  const effectiveHop = hopCount ?? initialHopCount;
  const effectiveGap = gapCount ?? initialGapCount;
  const effectiveResults = resultsAvailableCount ?? initialResultsCount;

  // When status transitions out of running, refresh server data so the
  // products grid (rendered by the parent SSR) re-fetches its results.
  // Section 13.2.1 item 2 — cache invalidation on terminal state.
  const isTerminal = TERMINAL.includes(effectiveStatus);
  useEffect(() => {
    if (isTerminal) {
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
      <StatusPill status={effectiveStatus} cancelling={cancelling} />
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
}: {
  status: RunStatus;
  cancelling: boolean;
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
  const tone =
    status === 'running' ? 'bg-blue-50 text-blue-700' :
    status === 'complete' ? 'bg-emerald-50 text-emerald-700' :
    status === 'partial' ? 'bg-amber-50 text-amber-700' :
    status === 'failed' ? 'bg-red-50 text-red-700' :
    'bg-slate-100 text-slate-700';
  return (
    <span className={`text-xs px-2 py-1 rounded ${tone}`}>{label}</span>
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
