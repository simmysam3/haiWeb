import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/watcher/runs/[id] — fetch run + per-counterparty
 * results. v1.28 Phase 5 BFF passthrough.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getWatcherRun(params.id));
});
