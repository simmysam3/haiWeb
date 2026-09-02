export type DefinitionTab = 'runs' | 'configuration';

/**
 * v1.85 — reads `?tab=` for a definition page (watcher or audit). Anything
 * but the exact value "configuration" — absent, unknown, or a repeated
 * param — opens Run history.
 *
 * Plain module on purpose: server page components call this, and a function
 * exported from a 'use client' module cannot be invoked from the server.
 */
export function parseDefinitionTab(value: string | string[] | undefined): DefinitionTab {
  return value === 'configuration' ? 'configuration' : 'runs';
}
