import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/sonar/compliance/requests/scopes/[id]/accept
 *
 * BFF passthrough to haiCore POST /sonar/compliance/requests/scopes/:id/accept.
 * haiCore returns 204 on success; 400/403/404/409 on error. We forward the
 * raw status + body verbatim — Task 22's DeclineDialog and Task 24's
 * RequestRow distinguish e.g. 409 SCOPE_STATE_CHANGED from a generic
 * server outage. Spec v1.35 Task 18.
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, request, params }) => {
  const body = await request.text();
  const haiCoreRes = await client.fetchRaw(
    `/sonar/compliance/requests/scopes/${encodeURIComponent(params.id)}/accept`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body || '{}',
    },
  );
  // 204 No Content — empty body, status-only forward.
  if (haiCoreRes.status === 204) return new NextResponse(null, { status: 204 });
  const text = await haiCoreRes.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return NextResponse.json(parsed, { status: haiCoreRes.status });
});
