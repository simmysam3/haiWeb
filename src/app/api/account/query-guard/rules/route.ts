import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { QueryGuardRuleUpsert } from '@haiwave/protocol';
import { forbidNonEditor } from '../_lib/authz';

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
 * (propagated by withHaiCore). Editing is restricted to
 * account_owner / account_admin (spec §9).
 */
export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = (await request.json()) as QueryGuardRuleUpsert;
  return NextResponse.json(await client.upsertQueryGuardRule(body));
});
