import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/phantom-demand/runs/[id]/status — lightweight
 * status poll (status + cancel_requested_at only).
 *
 * v1.30 PR-2 BFF passthrough (spec §7.6).
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getPhantomDemandRunStatus(params.id));
});
