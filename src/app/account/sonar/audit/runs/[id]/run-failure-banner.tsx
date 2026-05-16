import type { RunStatus } from '@haiwave/protocol';

/**
 * A failed run currently shows only a red "Failed" pill. The run's
 * error_message is carried end-to-end (haiCore audit-run-service → AuditRun)
 * but was never surfaced, so a user sees "Failed · 60 results" with no idea
 * what broke or whether the results are usable. This banner explains the
 * failure, says whether partial results are still shown, and always exposes
 * the raw technical reason for support/engineering.
 */
export function RunFailureBanner({
  status,
  errorMessage,
  resultsCount,
}: {
  status: RunStatus;
  errorMessage: string | null;
  resultsCount: number;
}) {
  if (status !== 'failed') return null;

  // Minimal, confirmed heuristic only: a unique-constraint violation means the
  // audit traversal finished and a post-completion side-effect (e.g. the SKU
  // obligation queue) hit a conflict — the results above are likely valid.
  const isPostProcessingConflict =
    !!errorMessage && /duplicate key|unique constraint/i.test(errorMessage);

  return (
    <div
      role="alert"
      className="rounded-md border border-problem/20 bg-problem/5 p-4 text-sm text-problem space-y-2"
    >
      <p className="font-medium">This run failed.</p>

      {resultsCount > 0 && (
        <p>
          {resultsCount} result{resultsCount === 1 ? '' : 's'} {resultsCount === 1 ? 'was' : 'were'}{' '}
          collected before the failure and {resultsCount === 1 ? 'is' : 'are'} shown below — these
          may still be usable.
        </p>
      )}

      {isPostProcessingConflict && (
        <p>
          The audit traversal itself appears to have completed; a post-processing
          step hit a duplicate-entry conflict. This is a known backend issue —
          the results above are likely valid.
        </p>
      )}

      <p className="text-xs">
        <span className="font-medium">Technical detail:</span>{' '}
        <code className="font-mono break-all">
          {errorMessage ?? 'no error detail was recorded for this run'}
        </code>
      </p>
    </div>
  );
}
