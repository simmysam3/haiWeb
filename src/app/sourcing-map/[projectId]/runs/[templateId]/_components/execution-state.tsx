'use client';
import type { SmExecutionSummary } from '@/lib/sourcing-map/contract';
import { answersAreStale, formatAsOfUtc } from '@/lib/sourcing-map/map/selectors';
import { SmButton } from '@/app/sourcing-map/_components/sm-button';

const FAILURE: Record<string, string> = {
  interrupted: 'it was interrupted by a restart',
  internal_error: 'an internal error stopped it',
};

/** Honest execution state (spec §9.3, AC 17): probing, failed, cancelled, or nothing yet. */
export function ExecutionBanner({ execution, onCancel, cancelling = false }: {
  execution: SmExecutionSummary | null; onCancel?: () => void; cancelling?: boolean;
}) {
  if (execution === null) {
    return <p role="status" className="sm-muted px-6 py-3 text-sm">No execution yet. Configure the run, then press Run.</p>;
  }
  if (execution.status === 'queued' || execution.status === 'running') {
    return (
      <div className="flex items-center gap-3 px-6 py-3 text-sm">
        <p role="status">{`Probing: ${execution.probes_done} of ${execution.probes_planned} probes answered`}</p>
        {/* R4: inert while the cancel request is in flight; busy, not disabled, so it keeps focus (LW-a). */}
        {onCancel && <SmButton className="sm-btn sm-btn-ghost text-xs" busy={cancelling} onClick={onCancel}>Cancel execution</SmButton>}
      </div>
    );
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

/** "Answers as of" (spec §9.3), with a warning when answers are more than 7 days old. */
export function AnswersAsOf({ asOf, now }: { asOf: string | null; now: Date }) {
  if (asOf === null) return null;
  return (
    <span className="text-xs">
      <span>{`Answers as of ${formatAsOfUtc(asOf)}`}</span>
      {answersAreStale(asOf, now) && (
        <span role="alert" className="sm-warn ml-2">Answers are more than 7 days old; run again for fresh answers.</span>
      )}
    </span>
  );
}
