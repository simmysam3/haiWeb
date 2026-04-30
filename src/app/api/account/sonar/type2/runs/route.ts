import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { Type2RunTriggerRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/type2/runs — list the caller's Type 2 runs.
 * POST /api/account/sonar/type2/runs — dispatch a new tier-1 sweep.
 *
 * v1.28 Phase 5 BFF passthrough. Auth, scope checks, edge filtering all
 * happen in haiCore. The BFF only adds the JWT + participant context.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listType2Runs());
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as Type2RunTriggerRequest;
  return NextResponse.json(await client.triggerType2Run(body));
});
