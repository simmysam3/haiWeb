import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/grounded-forecasts/runs/[run_id]/status — the cheap
 * poll (status + cancel_requested_at only) the result page runs while a run is
 * active, before fetching the heavy result once on a terminal status.
 *
 * v1.62 BFF passthrough, same two-tier polling shape as the PD run status route.
 */
export const GET = withHaiCore<{ run_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getGroundedForecastRunStatus(params.run_id));
});
