import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/runs/[id]/resumption-state
 *
 * BFF passthrough to GET /api/v1/sonar/runs/:id/resumption-state.
 * Returns RunResumptionState for the run owned by the calling participant.
 * 404 when run not found or has no resumption state (haiCore propagates
 * the distinction via error.code).
 *
 * v1.29 Phase 1.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getRunResumptionState(params.id));
});
