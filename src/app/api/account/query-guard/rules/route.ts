import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { QueryGuardRuleUpsert } from '@haiwave/protocol';

/**
 * GET /api/account/query-guard/rules — list the caller's stored query-guard
 * rules (overrides only; defaults are synthesized by the resolved matrix).
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listQueryGuardRules());
});

/**
 * PUT /api/account/query-guard/rules — create or update one rule. haiCore
 * performs Zod validation and rejects malformed bodies with a 4xx
 * (propagated by withHaiCore).
 */
export const PUT = withHaiCore(
  async ({ client, request }) => {
    const body = (await request.json()) as QueryGuardRuleUpsert;
    return NextResponse.json(await client.upsertQueryGuardRule(body));
  },
  { role: 'account_admin' },
);
