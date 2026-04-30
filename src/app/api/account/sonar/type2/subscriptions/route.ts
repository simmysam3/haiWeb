import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/type2/subscriptions — list subscriptions where
 * the caller is the responder. v1.28 Phase 5 BFF passthrough.
 *
 * The observer-side view is intentionally absent in v1.28 (the observer
 * sees results via run results, not via the subscription table directly).
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listType2Subscriptions());
});
