'use client';
import type { SmExecutionSummary } from '@/lib/sourcing-map/contract';

const FAILURE: Record<string, string> = {
  interrupted: 'it was interrupted by a restart',
  internal_error: 'an internal error stopped it',
};

/** Honest execution state (spec §9.3, AC 17): probing, failed, cancelled, or nothing yet. */
export function ExecutionBanner({ execution }: { execution: SmExecutionSummary | null }) {
  if (execution === null) {
    return <p role="status" className="sm-muted px-6 py-3 text-sm">No execution yet. Configure the run, then press Run.</p>;
  }
  if (execution.status === 'queued' || execution.status === 'running') {
    return <p role="status" className="px-6 py-3 text-sm">{`Probing: ${execution.probes_done} of ${execution.probes_planned} probes answered`}</p>;
  }
  if (execution.status === 'failed') {
    return (
      <p role="alert" className="sm-error px-6 py-3 text-sm">
        {`This execution failed: ${FAILURE[execution.failure_reason ?? 'internal_error'] ?? FAILURE.internal_error}. Run it again for a fresh result.`}
      </p>
    );
  }
  if (execution.status === 'cancelled') {
    return <p role="status" className="sm-muted px-6 py-3 text-sm">Cancelled. Answers that arrived afterwards were discarded.</p>;
  }
  return null;
}
