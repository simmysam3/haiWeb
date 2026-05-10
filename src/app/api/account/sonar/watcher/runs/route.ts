import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { WatcherRunTriggerRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/watcher/runs — list the caller's Watcher runs.
 * POST /api/account/sonar/watcher/runs — dispatch a new tier-1 sweep.
 *
 * v1.28 Phase 5 BFF passthrough. Auth, scope checks, edge filtering all
 * happen in haiCore. The BFF only adds the JWT + participant context.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listWatcherRuns());
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as WatcherRunTriggerRequest;
  return NextResponse.json(await client.triggerWatcherRun(body));
});
