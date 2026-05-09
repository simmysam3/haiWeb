import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { WatcherSignalSubscriptionPatch } from '@haiwave/protocol';

/**
 * PATCH /api/account/sonar/watcher/subscriptions/[id] — flip a
 * subscription's enabled flag. Ownership is enforced in haiCore (the
 * caller must be the responder of the subscription). v1.28 Phase 5 BFF
 * passthrough.
 */
export const PATCH = withHaiCore<{ id: string }>(async ({ client, params, request }) => {
  const body = (await request.json().catch(() => ({}))) as WatcherSignalSubscriptionPatch;
  return NextResponse.json(await client.patchWatcherSubscription(params.id, body));
});
