import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/account/query-guard/states/[id]/restore — manually restore a
 * blocked counterparty (block-with-restore action) ahead of any automatic
 * expiry.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, params }) => {
    return NextResponse.json(await client.restoreQueryGuardState(params.id));
  },
  { role: 'account_admin' },
);
