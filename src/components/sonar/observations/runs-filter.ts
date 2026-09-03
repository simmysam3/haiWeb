export type RunsFilter = 'active' | 'archived';

/**
 * v1.85 (D-206) — reads `?runs=` on a definition page's Run history tab.
 * Anything but the exact value "archived" — absent, unknown, or a repeated
 * param — shows the active (non-archived) list.
 *
 * Plain module on purpose: a server page component reads this too, and a
 * function exported from a 'use client' module cannot be invoked from the
 * server. Same split as parseDefinitionTab in
 * app/account/sonar/_lib/definition-tab.ts.
 */
export function parseRunsFilter(value: string | string[] | undefined): RunsFilter {
  return value === 'archived' ? 'archived' : 'active';
}
