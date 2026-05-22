import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { RunTriggerRequest } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/audit/runs — list audit runs for the caller's org.
 *   Optional query params: status, limit (both forwarded to haiCore; filtering
 *   and pagination are enforced server-side).
 *
 * POST /api/account/sonar/audit/runs — ad-hoc trigger an audit run.
 *   Body is a RunTriggerRequest (discriminated on scope_type: 'company' | 'key').
 *   run_origin is NOT a request field — it is determined by haiCore.
 *
 * BFF passthrough; auth + scope enforcement happen in haiCore.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') ?? undefined;
  const limitRaw = sp.get('limit');
  const limit = limitRaw === null ? undefined : Number(limitRaw);

  return NextResponse.json(await client.listAuditRuns({ status, limit }));
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as RunTriggerRequest;
  return NextResponse.json(await client.triggerAuditRun(body));
});
