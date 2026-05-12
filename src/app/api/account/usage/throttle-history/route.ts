import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/usage/throttle-history?days=N
 *
 * BFF passthrough to GET /api/v1/sonar/usage/throttle-history.
 * Returns { throttle_history: [...] } — throttled-run events for the
 * calling participant over the requested window.
 *
 * v1.30 PR-5 — Usage Page.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const days = url.searchParams.get('days');
  const result = await client.getThrottleHistory({
    days: days !== null ? Number(days) : undefined,
  });
  return NextResponse.json(result);
});
