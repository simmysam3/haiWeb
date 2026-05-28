'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  /**
   * Async trigger callback. Must POST the run and resolve to the new run id;
   * reject (or throw) with a user-readable message when the trigger fails.
   * Pages compose their own modality-specific fetch (audit hits
   * /definitions/:id/run; watcher hits /runs with the template's scope inline)
   * because the two endpoints have different payload shapes.
   */
  trigger: () => Promise<{ runId: string }>;
  /**
   * Base route to navigate to after a successful trigger; the new run id is
   * appended as `${runDetailRoute}/${runId}`.
   */
  runDetailRoute: string;
  /** Optional label override (defaults to "Run now"). */
  label?: string;
}

/**
 * Shared "Run now" button used in the actions slot of audit and watcher
 * definition page headers. Right-aligned styling comes from the PageHeader's
 * `actions` flex row — this component just renders the teal button + inline
 * error.
 */
export function RunNowButton({ trigger, runDetailRoute, label = 'Run now' }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const { runId } = await trigger();
      router.push(`${runDetailRoute}/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Run failed');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded bg-teal text-white px-4 py-1.5 text-sm font-semibold hover:bg-teal/90 disabled:opacity-60"
      >
        {busy ? 'Triggering…' : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-rose-700 max-w-xs text-right">
          {error}
        </span>
      )}
    </div>
  );
}
