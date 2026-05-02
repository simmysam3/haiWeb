import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/runs/throttled/count
 *
 * BFF passthrough to GET /api/v1/sonar/runs/throttled/count.
 * Returns { audit, type2, total } counts of throttled runs for the
 * calling participant. Used by the ThrottledRunsPanel on Sonar dashboards.
 *
 * v1.29 Phase 1.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getThrottledRunsCount());
});
