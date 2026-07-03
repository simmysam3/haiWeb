/**
 * v.1.37 Request Management — shared BFF path/query builder.
 *
 * Single source of truth for turning the (possibly legacy-aliased) direction
 * and item-type URL params into the BFF request path. Used by both the SSR
 * page fetch (page.tsx) and the SWR client key (request-management-client.tsx)
 * so the two can never drift out of lockstep with each other.
 */

export type RequestDirection = 'me' | 'them' | 'all' | 'declined';
export type RequestItemType = 'nomination' | 'obligation' | 'all';

export interface RequestQueueFilters {
  counterparty?: string | null;
  state?: string | null;
  ageBucket?: string | null;
}

// Declined items come from a separate endpoint with its own query contract
// (days=30 default; the legacy ?all=true escape hatch is no longer surfaced
// in the unified UI but the BFF still accepts it).
const DECLINED_PATH = '/api/sonar/compliance/requests/declined?days=30';

/**
 * Resolves the `direction` queue selector. Accepts the v1.35 `awaiting`
 * alias still emitted by the legacy 301 redirects (middleware.ts). Prefers
 * `primary`; unrecognized or absent values default to 'me'.
 */
export function normalizeDirection(
  primary: string | null | undefined,
  legacyAlias?: string | null,
): RequestDirection {
  const v = primary ?? legacyAlias;
  return v === 'them' || v === 'all' || v === 'declined' ? v : 'me';
}

/**
 * Resolves the `item_type` filter. Accepts the v1.35 `type` alias. Prefers
 * `primary`; unrecognized or absent values default to 'all'.
 */
export function normalizeItemType(
  primary: string | null | undefined,
  legacyAlias?: string | null,
): RequestItemType {
  const v = primary ?? legacyAlias;
  return v === 'nomination' || v === 'obligation' ? v : 'all';
}

/**
 * Builds the BFF path (with query string) for the Request Management queue.
 * Returns the fixed declined-endpoint path when `direction` is 'declined'
 * (ignoring `itemType`/`filters` — the declined endpoint has its own
 * contract). Otherwise builds `/api/sonar/compliance/requests` (no
 * `/account/` prefix — matches the Task 18 contract already used by the
 * orchestrator + RequestRow).
 */
export function buildRequestQueuePath(
  direction: RequestDirection,
  itemType: RequestItemType,
  filters: RequestQueueFilters = {},
): string {
  if (direction === 'declined') return DECLINED_PATH;
  const qs = new URLSearchParams();
  qs.set('awaiting', direction);
  qs.set('type', itemType);
  if (filters.counterparty) qs.set('counterparty', filters.counterparty);
  if (filters.state) qs.set('state', filters.state);
  if (filters.ageBucket) qs.set('age_bucket', filters.ageBucket);
  return `/api/sonar/compliance/requests?${qs.toString()}`;
}
