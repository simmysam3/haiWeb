import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/sonar/compliance/requests
 *
 * BFF passthrough to haiCore GET /sonar/compliance/requests.
 * Supports query params: awaiting (me|them|all), type (nomination|obligation|all),
 * counterparty (participant UUID). Spec v1.35 Task 18.
 *
 * Note: the BFF tree intentionally roots this surface at `/api/sonar/...` (no
 * `/account/` prefix) because the orchestrator + RequestRow already use that
 * contract — see request-management-client.tsx + request-row.tsx.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const awaitingRaw = sp.get('awaiting');
  const typeRaw = sp.get('type');
  return NextResponse.json(await client.listRequests({
    awaiting: awaitingRaw === 'me' || awaitingRaw === 'them' || awaitingRaw === 'all'
      ? awaitingRaw : undefined,
    type: typeRaw === 'nomination' || typeRaw === 'obligation' || typeRaw === 'all'
      ? typeRaw : undefined,
    counterparty: sp.get('counterparty') ?? undefined,
  }));
});
