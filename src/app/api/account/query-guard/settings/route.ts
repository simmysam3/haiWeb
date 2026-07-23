import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forbidNonEditor } from '../_lib/authz';

/**
 * GET /api/account/query-guard/settings — participant-level query-guard
 * settings (default alert email).
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getQueryGuardSettings());
});

/**
 * PUT /api/account/query-guard/settings — update the default alert email
 * (null clears it). Editing is restricted to account_owner / account_admin
 * (spec §9): guard alerts carry counterparty probing detail, so redirecting
 * them is an owner/admin-only action.
 */
export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = (await request.json()) as { default_alert_email?: string | null };
  return NextResponse.json(await client.putQueryGuardSettings(body.default_alert_email ?? null));
});
