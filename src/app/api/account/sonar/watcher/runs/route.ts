import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { WatcherRunTriggerRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/watcher/runs — list the caller's Watcher runs.
 *   Optional ?template_id=<uuid> filters to runs from a specific watcher
 *   template. Used by the definition-detail page so its history table doesn't
 *   bleed in ad-hoc runs from other watchers.
 * POST /api/account/sonar/watcher/runs — dispatch a new tier-1 sweep.
 *
 * v1.28 Phase 5 BFF passthrough. Auth, scope checks, edge filtering all
 * happen in haiCore. The BFF only adds the JWT + participant context.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const templateId = new URL(request.url).searchParams.get('template_id');
  return NextResponse.json(
    await client.listWatcherRuns(templateId ? { template_id: templateId } : undefined),
  );
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as WatcherRunTriggerRequest;
  return NextResponse.json(await client.triggerWatcherRun(body));
});
