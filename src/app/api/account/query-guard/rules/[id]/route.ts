import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forbidNonEditor } from '../../_lib/authz';

/**
 * DELETE /api/account/query-guard/rules/[id] — delete one stored override
 * row ("Reset to default" in the rules matrix). haiCore returns 204 on
 * success / 404 for an unknown id (propagated by withHaiCore). Editing is
 * restricted to account_owner / account_admin (spec §9).
 */
export const DELETE = withHaiCore<{ id: string }>(async ({ client, params, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  await client.deleteQueryGuardRule(params.id);
  return new NextResponse(null, { status: 204 });
});
