import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { WatcherRunTriggerRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/watcher/runs — list the caller's Watcher runs.
 *   Optional ?template_id=<uuid> filters to runs from a specific watcher
 *   template. Used by the definition-detail page so its history table doesn't
 *   bleed in ad-hoc runs from other watchers.
 *   Optional ?archived=true includes archived runs — v1.85 (2026-09-02):
 *   archived runs are excluded server-side by default (D-206).
 * POST /api/account/sonar/watcher/runs — dispatch a new tier-1 sweep.
 *
 * v1.28 Phase 5 BFF passthrough. Auth, scope checks, edge filtering all
 * happen in haiCore. The BFF only adds the JWT + participant context.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const templateId = sp.get('template_id');
  const archived = sp.get('archived') === 'true';
  const opts: { template_id?: string; archived?: boolean } = {};
  if (templateId) opts.template_id = templateId;
  if (archived) opts.archived = true;
  return NextResponse.json(
    await client.listWatcherRuns(Object.keys(opts).length ? opts : undefined),
  );
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as WatcherRunTriggerRequest;
  return NextResponse.json(await client.triggerWatcherRun(body));
}, { role: 'account_admin' });
