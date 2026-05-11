import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/throttle-status
 *
 * BFF passthrough to GET /api/v1/account/throttle-status.
 * Returns { count, most_recent_modality } summarising the caller's currently
 * throttled runs across audit, watcher, and phantom_demand modalities.
 * Polled by the ThrottleHeaderIndicator (~30s) to surface a header badge.
 *
 * v1.30 PR-6 Phase 8.
 */
export const GET = withHaiCore(async ({ client }) => {
  const result = await client.getThrottleStatus();
  return NextResponse.json(result);
});
