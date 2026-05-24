import { redirect } from 'next/navigation';

/**
 * v.1.41: Declined merged into the unified `/account/sonar/requests` page as
 * `?direction=declined`. This route stays as a 307 redirect so legacy
 * bookmarks, prior 301-chain targets (proxy.ts → /requests/declined), and
 * external links continue to land on the live surface.
 *
 * The historical `?all=true` query string (the older "show full backlog
 * instead of last 30 days" toggle) is no longer surfaced in the unified UI;
 * any pre-existing bookmarks with `?all=true` still land on the declined
 * tab, just without the time-range escape hatch.
 */
export default function DeclinedRedirect() {
  redirect('/account/sonar/requests?direction=declined');
}
