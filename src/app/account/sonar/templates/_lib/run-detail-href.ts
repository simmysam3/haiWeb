type ObservationClass =
  | 'audit'
  | 'watcher'
  | 'phantom_demand'
  | 'grounded_forecast';

/**
 * Where a "run detail" link for a triggered run should point, per modality.
 *
 * Audit runs currently render on the watcher run-detail route (no dedicated
 * audit run page exists yet) — that mapping is intentional, not a typo.
 * Watcher has no per-run detail page, so it lands on the watcher dashboard.
 * Grounded forecasts store only the latest result and key it by template, not
 * by run, so there is nothing to address per run: the link lands on the
 * forecast list, from which the caller opens the template's result.
 */
export function runDetailHref(klass: ObservationClass, runId: string): string {
  switch (klass) {
    case 'audit':
      return `/account/sonar/watchers/${runId}`;
    case 'phantom_demand':
      return `/account/sonar/phantom-demand/runs/${runId}`;
    case 'watcher':
      return `/account/sonar/watcher/dashboard`;
    case 'grounded_forecast':
      return `/account/sonar/grounded-forecasts`;
  }
}
