import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/usage/timeseries?window_days=N
 *
 * BFF passthrough to GET /api/v1/sonar/usage/timeseries.
 * Returns { buckets: [{ window_start, hops_consumed }] }.
 *
 * v1.30 PR-5 — Usage Page.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const window_days = url.searchParams.get('window_days');
  const result = await client.getUsageTimeseries({
    window_days: window_days !== null ? Number(window_days) : undefined,
  });
  return NextResponse.json(result);
});
