interface Props {
  counts: { audit: number; type2: number; total: number };
}

/**
 * ThrottledRunsPanel — shows a summary of currently-throttled runs on
 * Sonar modality dashboards. Returns null when total === 0 so it is
 * invisible in the common case.
 *
 * Server-renderable (no client-side state needed — counts are fetched
 * at page-load time).
 *
 * v1.29 Phase 1.
 */
export function ThrottledRunsPanel({ counts }: Props) {
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
        {counts.type2 > 0 && ` · ${counts.type2} Type 2`}.
      </p>
    </div>
  );
}
