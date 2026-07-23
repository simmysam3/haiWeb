import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forbidNonEditor } from '../../../_lib/authz';

/**
 * POST /api/account/query-guard/states/[id]/clear — clear an elevated-logging
 * (`log`) state. haiCore's clear endpoint closes only log states; pauses are
 * never cleared here — they lapse on their own `expires_at` (lazy expiry).
 * Restricted to account_owner / account_admin (spec §9).
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, params, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  return NextResponse.json(await client.clearQueryGuardState(params.id));
});
