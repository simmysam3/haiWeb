/**
 * The `?kind=` values a backlog surface forwards to haiCore.
 *
 * Each backlog page (Watcher Backlog, Event Backlog) owns a pill set that
 * doubles as its wire allowlist. Requested kinds outside the set are dropped
 * (a stale link from the other surface, a typo). The result is NEVER empty:
 * when nothing was requested, or nothing requested survives, the full pill
 * set goes on the wire. An empty `kind` list is not "no rows" to haiCore, it
 * is "no filter" — the whole non-gap feed, every kind of the other surface
 * included (SEC-web-sonar-3-03; the v1.73 WP4 incident by a user-supplied
 * route). haiCore's own handling of an unknown kind is to ignore it, which is
 * right for the API and is exactly why the surface must fail closed here.
 */
export function resolveKindFilter(
  requested: string | string[] | undefined,
  pills: readonly string[],
): string[] {
  const asked = Array.isArray(requested) ? requested : requested ? [requested] : [];
  const allowed = new Set<string>(pills);
  const kept = asked.filter((k) => allowed.has(k));
  return kept.length ? kept : [...pills];
}
