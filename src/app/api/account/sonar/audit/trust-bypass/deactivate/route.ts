import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { TrustBypassDeactivationRequest } from '@haiwave/protocol';

/**
 * POST /api/account/sonar/audit/trust-bypass/deactivate
 *
 * BFF passthrough to haiCore POST /sonar/audit/trust-bypass/deactivate.
 * Body: { trust_class }. haiCore returns 204 No Content on success; we
 * surface that as an empty 204 to the browser so the SWR mutate() in the
 * trust-bypass page settles cleanly.
 * Spec §11.1.
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json()) as TrustBypassDeactivationRequest;
  await client.deactivateTrustBypass(body);
  return new NextResponse(null, { status: 204 });
});
