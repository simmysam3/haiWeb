'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WatcherRun, WatcherRunStatus } from '@haiwave/protocol';
import { useRunStatus, TERMINAL } from './use-run-status';
import { Pill } from '@/components/pill';

interface RunControlsProps {
  run: WatcherRun;
}

/**
 * Watcher run-detail status pill + cancel control.
 *
 * v.1.43 Task 21 — slimmed from the audit-shaped predecessor: WatcherRun has
 * no hop_count / gap_count / results_available_count / error_message, so this
 * component renders only the status pill and (when running) a Cancel button.
 * Counter chips and the error-tooltip detail line are owned elsewhere.
 */
export function RunControls({ run }: RunControlsProps) {
  const router = useRouter();
  const { status, mutate } = useRunStatus(run.run_id);

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const effectiveStatus = status ?? run.status;

  // Refresh server data when the polled status transitions out of running so
  // the counterparties grid (parent SSR) re-fetches its results. Guarded by
  // `wasNonTerminal` so an SSR mount of an already-terminal run doesn't fire
  // a wasted RSC round-trip.
  const isTerminal = TERMINAL.includes(effectiveStatus);
  const wasNonTerminal = useRef(!TERMINAL.includes(run.status));
  useEffect(() => {
    if (isTerminal && wasNonTerminal.current) {
      wasNonTerminal.current = false;
      router.refresh();
    }
  }, [isTerminal, router]);

  // Clear the local cancelling indicator once the worker reports terminal.
  useEffect(() => {
    if (cancelling && isTerminal) {
      setCancelling(false);
    }
  }, [cancelling, isTerminal]);

  async function handleCancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(
        `/api/account/sonar/watcher/runs/${run.run_id}/cancel`,
        { method: 'POST', credentials: 'include' },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Cancel failed: ${res.status}`);
      }
      // One-shot 500ms-delayed reconciliation — gives the worker a tick to
      // flip the row before SWR refetches.
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
      {effectiveStatus === 'running' && !cancelling && (
        <button
          type="button"
          onClick={handleCancel}
          className="text-sm px-3 py-1 rounded border border-slate/20 text-charcoal hover:bg-light-gray transition-colors"
        >
          Cancel
        </button>
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
  status: WatcherRunStatus;
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
  return <Pill category="run_status" value={status} />;
}

function AnimatedDots() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 400);
    return () => clearInterval(id);
  }, []);
  return <span aria-hidden>{'.'.repeat(tick)}</span>;
}
