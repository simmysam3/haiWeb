import { permanentRedirect } from 'next/navigation';

/**
 * v1.73 WP4: the singular "Watcher — Continuous observation" dashboard is
 * retired. Its run-history role is served by the Watchers list's history
 * column pack; per-counterparty snapshots live on each run's detail page.
 * Permanent (308) so bookmarks and any external links converge on the live
 * surface. The plural /account/sonar/watchers family is the only watcher home.
 */
export default function LegacyWatcherDashboardRedirect() {
  permanentRedirect('/account/sonar/watchers');
}
