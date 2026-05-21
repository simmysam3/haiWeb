import type { CoverageCurrentResponse, CoverageTrend } from '@haiwave/protocol';
import { fetchBffJson, type FetchResult } from '@/lib/server-fetch';

/**
 * v1.37 polish — shared coverage loader. Both the Sonar Dashboard
 * (canonical coverage surface) and the Posture coverage-header strip pull
 * the SAME two BFF endpoints on every render:
 *   - `/api/account/sonar/compliance/coverage/current`
 *   - `/api/account/sonar/compliance/coverage/trend`
 *
 * Extracting the pair here keeps both consumers in lockstep when the
 * coverage routes change shape. We deliberately do NOT add cross-request
 * caching: Next 16's implicit request memoization already dedupes the two
 * underlying `fetch` calls within a single request graph, which is exactly
 * the dedupe we want without over-caching across users / sessions.
 *
 * Both lanes are returned as `FetchResult<T>` so each caller can pick its
 * own failure mode:
 *   - the Dashboard surfaces a status-aware banner on `kind === 'error'`,
 *   - the Posture header strip silently renders nothing.
 */
export async function loadCoverage(): Promise<{
  current: FetchResult<CoverageCurrentResponse>;
  trend: FetchResult<CoverageTrend>;
}> {
  const [current, trend] = await Promise.all([
    fetchBffJson<CoverageCurrentResponse>(
      '/api/account/sonar/compliance/coverage/current',
    ),
    fetchBffJson<CoverageTrend>(
      '/api/account/sonar/compliance/coverage/trend',
    ),
  ]);
  return { current, trend };
}
