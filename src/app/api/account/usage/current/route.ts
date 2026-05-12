import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/usage/current
 *
 * BFF passthrough to GET /api/v1/sonar/budget/current.
 * Returns { participant_id, window_start, consumed, remaining, budget }.
 *
 * v1.30 PR-5 — Usage Page.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getBudgetCurrent());
});
