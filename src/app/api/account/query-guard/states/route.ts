import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/query-guard/states — active enforcement states
 * (pauses / blocks) for the caller's counterparties.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listQueryGuardStates());
});
