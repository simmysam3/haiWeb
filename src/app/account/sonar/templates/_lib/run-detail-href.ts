type ObservationClass =
  | 'audit'
  | 'watcher'
  | 'phantom_demand'
  | 'grounded_forecast';

/**
 * Where a "run detail" link for a triggered run should point, per modality.
 *
 * v1.73 WP4: audit and watcher runs each route to their OWN detail page —
 * /account/sonar/audit/[run_id] and /account/sonar/watchers/[id] both exist.
 * (This file's previous comment claimed neither did; that was stale, and the
 * audit→watchers mapping it justified sent users to the wrong run.)
 * Grounded forecasts store only the latest result keyed by template, not by
 * run, so there is nothing to address per run: the link lands on the list.
 */
export function runDetailHref(klass: ObservationClass, runId: string): string {
  switch (klass) {
    case 'audit':
      return `/account/sonar/audit/${runId}`;
    case 'phantom_demand':
      return `/account/sonar/phantom-demand/runs/${runId}`;
    case 'watcher':
      return `/account/sonar/watchers/${runId}`;
    case 'grounded_forecast':
      return `/account/sonar/grounded-forecasts`;
  }
}
