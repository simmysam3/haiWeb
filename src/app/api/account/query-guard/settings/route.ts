import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/query-guard/settings — participant-level query-guard
 * settings (default alert email).
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getQueryGuardSettings());
});

/**
 * PUT /api/account/query-guard/settings — update the default alert email
 * (null clears it).
 */
export const PUT = withHaiCore(
  async ({ client, request }) => {
    const body = (await request.json()) as { default_alert_email?: string | null };
    return NextResponse.json(await client.putQueryGuardSettings(body.default_alert_email ?? null));
  },
  { role: 'account_admin' },
);
