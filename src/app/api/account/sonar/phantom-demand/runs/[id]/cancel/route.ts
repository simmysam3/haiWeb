import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/account/sonar/phantom-demand/runs/[id]/cancel — request
 * cancellation of a running PD probe at the next orchestrator boundary.
 *
 * Semantics (only running/queued runs can cancel; idempotent on a
 * cancel_requested_at already set) are enforced in haiCore. The BFF just
 * forwards with the caller's participant context.
 *
 * v1.30 PR-2 BFF passthrough (spec §7.6).
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.cancelPhantomDemandRun(params.id));
});
