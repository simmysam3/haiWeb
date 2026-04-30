'use client';

import type { Type2Run, Type2RunStatus } from '@haiwave/protocol';

interface RunHistoryProps {
  runs: Type2Run[];
  /** Called after a successful cancel so the parent can revalidate SWR. */
  onCancel: () => void;
}

const STATUS_PILL_CLASSES: Record<Type2RunStatus, string> = {
  running: 'bg-amber-50 text-amber-700 border-amber-200',
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-50 text-slate-700 border-slate-200',
};

function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

async function cancelRun(runId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/account/sonar/type2/runs/${runId}/cancel`,
      { method: 'POST' },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Run history table — rows for each Type 2 run with status pill, signal
 * types, counterparty filter (or "all"), trigger time, completion time,
 * and an inline cancel button while running.
 */
export function RunHistory({ runs, onCancel }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-slate italic">
        No runs yet. Click <strong>Run Type 2 observation</strong> above to start one.
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
          {runs.map((run) => (
            <tr key={run.run_id}>
              <td className="px-4 py-2">
                <span
                  className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_PILL_CLASSES[run.status]}`}
                >
                  {run.status}
                </span>
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
                {run.status === 'running' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await cancelRun(run.run_id);
                      if (ok) onCancel();
                    }}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
