import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * DELETE /api/account/query-guard/rules/[id] — delete one stored override
 * row ("Reset to default" in the rules matrix). haiCore returns 204 on
 * success / 404 for an unknown id (propagated by withHaiCore).
 */
export const DELETE = withHaiCore<{ id: string }>(
  async ({ client, params }) => {
    await client.deleteQueryGuardRule(params.id);
    return new NextResponse(null, { status: 204 });
  },
  { role: 'account_admin' },
);
