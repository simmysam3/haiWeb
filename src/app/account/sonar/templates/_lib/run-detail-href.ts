type ObservationClass = 'audit' | 'watcher' | 'phantom_demand';

/**
 * Where a "run detail" link for a triggered run should point, per modality.
 *
 * Audit runs currently render on the watcher run-detail route (no dedicated
 * audit run page exists yet) — that mapping is intentional, not a typo.
 * Watcher has no per-run detail page, so it lands on the watcher dashboard.
 */
export function runDetailHref(klass: ObservationClass, runId: string): string {
  switch (klass) {
    case 'audit':
      return `/account/sonar/watchers/${runId}`;
    case 'phantom_demand':
      return `/account/sonar/phantom-demand/runs/${runId}`;
    case 'watcher':
      return `/account/sonar/watcher/dashboard`;
  }
}
