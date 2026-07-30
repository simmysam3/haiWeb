import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { QueryGuardTestRequest } from '@haiwave/protocol';

/**
 * POST /api/account/query-guard/test — dry-run a hypothetical query pattern
 * against the caller's resolved rules. Read-only: never records state or
 * emits events.
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json()) as QueryGuardTestRequest;
  return NextResponse.json(await client.testQueryGuardRules(body));
});
