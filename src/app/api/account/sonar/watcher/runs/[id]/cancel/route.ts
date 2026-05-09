import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/account/sonar/watcher/runs/[id]/cancel — request cancellation
 * at the next worker boundary. v1.28 Phase 5 BFF passthrough.
 *
 * The actual cancel semantics (only running runs can cancel, single
 * canonical audit emission from the worker) are enforced in haiCore;
 * this BFF just forwards.
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.cancelWatcherRun(params.id));
});
