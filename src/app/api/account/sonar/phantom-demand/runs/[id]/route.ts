import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/phantom-demand/runs/[id] — fetch run detail
 * including per-SKU probe results.
 *
 * v1.30 PR-2 BFF passthrough (spec §7.6).
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getPhantomDemandRun(params.id));
});
