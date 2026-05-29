'use client';

import { useEffect, useState } from 'react';
import type { WatcherRun, WatcherRunStatus } from '@haiwave/protocol';

interface RunHistoryProps {
  runs: WatcherRun[];
  /** Called after a successful cancel so the parent can revalidate SWR. */
  onCancel: () => void;
  /** Called after a successful delete so the parent can revalidate SWR. */
  onDelete: () => void;
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

const STATUS_PILL_CLASSES: Record<WatcherRunStatus, string> = {
  running: 'bg-amber-50 text-amber-700 border-amber-200',
  throttled: 'bg-amber-50 text-amber-700 border-amber-200',
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-50 text-slate-700 border-slate-200',
};

const CANCELLING_PILL_CLASSES =
  'bg-slate-50 text-slate-600 border-slate-200';

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

/**
 * Run history table — rows for each Watcher run with status pill, signal
 * types, counterparty filter (or "all"), trigger time, completion time,
 * and an inline cancel button while running.
 *
 * Cancel UX: tracks per-row in-flight cancels in a Set so the button
 * disables instantly (preventing double-click) and the status pill shows
 * "Cancelling…" until SWR's next poll surfaces the new status (running →
 * cancelled / failed). On non-OK response the runId is cleared from the
 * set and an inline error is rendered for that row.
 */
export function RunHistory({ runs, onCancel, onDelete }: RunHistoryProps) {
  const [cancellingRunIds, setCancellingRunIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});
  const [deletingRunIds, setDeletingRunIds] = useState<Set<string>>(() => new Set());
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // When SWR observes that a previously-cancelling run has left the
  // 'running' state, drop it from the local cancelling set. This keeps
  // the "Cancelling…" pill visible across the gap between the 200 OK
  // and the next 5s SWR poll, then cleans up automatically.
  useEffect(() => {
    if (cancellingRunIds.size === 0) return;
    const stillRunning = new Set(
      runs.filter((r) => r.status === 'running').map((r) => r.run_id),
    );
    let changed = false;
    const next = new Set(cancellingRunIds);
    for (const id of cancellingRunIds) {
      if (!stillRunning.has(id)) {
        next.delete(id);
        changed = true;
      }
    }
    if (changed) setCancellingRunIds(next);
  }, [runs, cancellingRunIds]);

  async function handleCancel(runId: string) {
    setCancellingRunIds((prev) => {
      const next = new Set(prev);
      next.add(runId);
      return next;
    });
    setCancelErrors((prev) => {
      if (!(runId in prev)) return prev;
      const next = { ...prev };
      delete next[runId];
      return next;
    });
    try {
      const res = await fetch(
        `/api/account/sonar/watcher/runs/${runId}/cancel`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Cancel failed: ${res.status}`);
      }
      onCancel();
    } catch (err) {
      console.error('[RunHistory] cancel failed', { runId, err });
      setCancellingRunIds((prev) => {
        if (!prev.has(runId)) return prev;
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
      setCancelErrors((prev) => ({
        ...prev,
        [runId]: err instanceof Error ? err.message : 'Cancel failed',
      }));
    }
  }

  async function handleDelete(runId: string) {
    setConfirmDeleteId(null);
    setDeletingRunIds((prev) => new Set(prev).add(runId));
    setDeleteErrors((prev) => {
      if (!(runId in prev)) return prev;
      const next = { ...prev };
      delete next[runId];
      return next;
    });
    try {
      const res = await fetch(`/api/account/sonar/watcher/runs/${runId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Delete failed: ${res.status}`);
      }
      onDelete();
    } catch (err) {
      console.error('[RunHistory] delete failed', { runId, err });
      setDeletingRunIds((prev) => {
        if (!prev.has(runId)) return prev;
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
      setDeleteErrors((prev) => ({
        ...prev,
        [runId]: err instanceof Error ? err.message : 'Delete failed',
      }));
    }
  }

  if (runs.length === 0) {
    return (
      <p className="text-sm text-slate italic">
        No runs yet. Click <strong>Run Watcher observation</strong> above to start one.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate">
          <tr>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Signals</th>
            <th className="px-4 py-2">Counterparties</th>
            <th className="px-4 py-2">Triggered</th>
            <th className="px-4 py-2">Completed</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {runs.map((run) => {
            const isCancelling =
              cancellingRunIds.has(run.run_id) && run.status === 'running';
            const cancelError = cancelErrors[run.run_id];
            return (
              <tr key={run.run_id}>
                <td className="px-4 py-2">
                  {isCancelling ? (
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${CANCELLING_PILL_CLASSES}`}
                    >
                      Cancelling…
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_PILL_CLASSES[run.status]}`}
                    >
                      {run.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-charcoal">
                  {run.signal_types.join(', ')}
                </td>
                <td className="px-4 py-2 text-charcoal">
                  {run.counterparty_filter
                    ? `${run.counterparty_filter.length} selected`
                    : 'all tier-1'}
                </td>
                <td className="px-4 py-2 text-charcoal">{formatTime(run.triggered_at)}</td>
                <td className="px-4 py-2 text-charcoal">{formatTime(run.completed_at)}</td>
                <td className="px-4 py-2">
                  {run.status === 'running' ? (
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleCancel(run.run_id)}
                        disabled={isCancelling}
                        className="text-xs text-rose-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                      >
                        Cancel
                      </button>
                      {cancelError && (
                        <span className="text-xs text-rose-600">
                          {cancelError}
                        </span>
                      )}
                    </div>
                  ) : confirmDeleteId === run.run_id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-slate">Delete?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(run.run_id)}
                        className="text-xs font-medium text-rose-600 hover:underline"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-slate hover:underline"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      {deletingRunIds.has(run.run_id) ? (
                        <span className="text-xs italic text-slate">Deleting…</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(run.run_id)}
                          aria-label="Delete run"
                          title="Delete run"
                          className="text-slate-400 transition-colors hover:text-rose-600"
                        >
                          <TrashIcon />
                        </button>
                      )}
                      {deleteErrors[run.run_id] && (
                        <span className="text-xs text-rose-600">
                          {deleteErrors[run.run_id]}
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
