import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/account/query-guard/states/[id]/clear — clear an active pause
 * early (or dismiss a lingering state) without waiting for its window to
 * lapse.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, params }) => {
    return NextResponse.json(await client.clearQueryGuardState(params.id));
  },
  { role: 'account_admin' },
);
