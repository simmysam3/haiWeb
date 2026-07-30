import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forbidNonEditor } from '../../../_lib/authz';

/**
 * POST /api/account/query-guard/states/[id]/restore — manually restore a
 * blocked counterparty (block-with-restore action) ahead of any automatic
 * expiry. Restricted to account_owner / account_admin (spec §9).
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, params, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  return NextResponse.json(await client.restoreQueryGuardState(params.id));
});
