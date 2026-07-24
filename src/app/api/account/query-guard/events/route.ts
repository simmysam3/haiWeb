import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/query-guard/events — trip history, optionally filtered by
 * counterparty and/or rule_type. `limit` caps the page size (haiCore
 * enforces its own maximum).
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const counterparty = sp.get('counterparty') ?? undefined;
  const ruleType = sp.get('rule_type') ?? undefined;
  const limitRaw = sp.get('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;
  return NextResponse.json(
    await client.listQueryGuardEvents({
      counterparty,
      rule_type: ruleType,
      limit: Number.isFinite(limit) ? limit : undefined,
    }),
  );
});
