import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

// NO POST. The legacy ad-hoc trigger was removed 2026-06-09 alongside the one
// on /api/account/sonar/audit/runs: it had no UI callers, and any stale caller
// (old browser chunk, script) silently created template-less runs that can
// never carry a user-given audit name. Portal triggers go through the
// definitions flow (POST /definitions then /definitions/:id/run).
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status');
  const limit = sp.get('limit');

  return NextResponse.json(
    await client.listAuditRuns({
      status: status ?? undefined,
      limit: limit === null ? undefined : Number(limit),
    }),
  );
});
