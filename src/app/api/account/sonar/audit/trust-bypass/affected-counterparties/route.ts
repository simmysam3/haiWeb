import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { TrustClass } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/audit/trust-bypass/affected-counterparties?trust_class=...
 *
 * BFF passthrough that forwards the trust_class query param to haiCore.
 * Validation of the enum is handled server-side; we forward whatever the
 * caller sends and propagate any 400 verbatim.
 * Spec §7.5 (modal preview), §11.1.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const trustClass = request.nextUrl.searchParams.get('trust_class') ?? '';
  return NextResponse.json(
    await client.getTrustBypassAffectedCounterparties(trustClass as TrustClass),
  );
});
