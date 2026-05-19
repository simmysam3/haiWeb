import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/audit/trust-bypass/configs
 *
 * BFF passthrough to haiCore GET /sonar/compliance/trust-bypass/configs.
 * Lists trust-bypass configs owned by the authenticated responder.
 * Spec §11.1.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listTrustBypassConfigs());
});
