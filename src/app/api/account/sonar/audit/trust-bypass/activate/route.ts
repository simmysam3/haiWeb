import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { TrustBypassActivationRequest } from '@haiwave/protocol';

/**
 * POST /api/account/sonar/audit/trust-bypass/activate
 *
 * BFF passthrough to haiCore POST /sonar/compliance/trust-bypass/activate.
 * Body: { trust_class, activation_mode, retroactive_acknowledgement }.
 * haiCore enforces the retroactive-acknowledgement refine; we forward 400s
 * verbatim. On success returns { config, dissolution }.
 * Spec §7.5, §11.1.
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json()) as TrustBypassActivationRequest;
  return NextResponse.json(await client.activateTrustBypass(body));
});
