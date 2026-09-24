/**
 * Which configurations the dashboard's "Run all" triggers and counts.
 * A Sourcing Map run is a portfolio probe of every candidate supplier and
 * counts toward their hourly limits; it is started from its workspace only
 * (R-10 census H6), never swept up by Run all.
 */
export function isRunAllEligible(t: { enabled: boolean; observation_class: string }): boolean {
  return t.enabled && t.observation_class !== 'sourcing_map';
}
