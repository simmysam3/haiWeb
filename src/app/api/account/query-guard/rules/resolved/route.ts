import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/query-guard/rules/resolved — the effective rule matrix
 * (default → client-global → trust-class precedence), one row per
 * (scope, rule_type) with its winning source.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getQueryGuardMatrix());
});
