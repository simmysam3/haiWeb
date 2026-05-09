interface Props {
  counts: { audit: number; watcher: number; total: number } | null;
}

/**
 * ThrottledRunsPanel — shows a summary of currently-throttled runs on
 * Sonar modality dashboards. Three render modes:
 *
 *   - counts === null      → "throttle status unavailable" banner. The count
 *                            endpoint failed; surface that to the operator
 *                            rather than collapsing to a clean dashboard.
 *   - counts.total === 0   → render nothing (the common, healthy case).
 *   - counts.total > 0     → render the throttled-runs summary banner.
 *
 * Server-renderable (no client-side state needed — counts are fetched
 * at page-load time by the parent page).
 *
 * v1.29 Phase 1.
 */
export function ThrottledRunsPanel({ counts }: Props) {
  if (counts === null) {
    return (
      <div className="rounded-md bg-rose-50 border border-rose-200 p-3 mb-4">
        <h3 className="text-sm font-semibold text-rose-900 mb-1">
          Throttle status unavailable
        </h3>
        <p className="text-xs text-rose-900">
          Could not load the throttled-runs count. Refresh the page to retry, or
          check the operations status if this persists.
        </p>
      </div>
    );
  }
  if (counts.total === 0) return null;
  return (
    <div className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-4">
      <h3 className="text-sm font-semibold text-amber-900 mb-1">
        Throttled runs
      </h3>
      <p className="text-xs text-amber-900">
        {counts.total} run{counts.total !== 1 ? 's' : ''} currently waiting
        for budget refresh
        {counts.audit > 0 && ` · ${counts.audit} audit`}
        {counts.watcher > 0 && ` · ${counts.watcher} Watcher`}.
      </p>
    </div>
  );
}
