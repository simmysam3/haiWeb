import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/budget/current
 *
 * BFF passthrough to GET /api/v1/sonar/budget/current.
 * Returns { participant_id, window_start, consumed, remaining, budget }
 * for the calling participant's current hourly hop-budget window.
 *
 * v1.29 Phase 1.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getBudgetCurrent());
});
