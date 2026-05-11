import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/usage/active-runs
 *
 * BFF passthrough to GET /api/v1/sonar/usage/active-runs.
 * Returns { active_runs: [...] } — runs in running or throttled state for
 * the calling participant.
 *
 * v1.30 PR-5 — Usage Page.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getActiveRuns());
});
