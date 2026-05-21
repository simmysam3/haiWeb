import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/sonar/compliance/requests/scopes/[id]/withdraw
 *
 * BFF passthrough to haiCore POST /sonar/compliance/requests/scopes/:id/withdraw.
 * Initiator-only action; haiCore collapses vendor-vs-initiator distinction into
 * a single 409 SCOPE_STATE_CHANGED to avoid leaking participant-role info.
 * 204 on success; 400/403/404/409 forwarded verbatim. Spec v1.35 Task 18.
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, request, params }) => {
  const body = await request.text();
  const haiCoreRes = await client.fetchRaw(
    `/sonar/compliance/requests/scopes/${encodeURIComponent(params.id)}/withdraw`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body || '{}',
    },
  );
  if (haiCoreRes.status === 204) return new NextResponse(null, { status: 204 });
  const text = await haiCoreRes.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return NextResponse.json(parsed, { status: haiCoreRes.status });
});
