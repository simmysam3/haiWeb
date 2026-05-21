import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/sonar/compliance/requests/obligations/[id]/decline
 *
 * BFF passthrough to haiCore POST /sonar/compliance/requests/obligations/:id/decline.
 * Body: { reason?: string } (≤ 2000 chars). 204 on success; 400/404 forwarded
 * verbatim. Spec v1.35 Task 18.
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, request, params }) => {
  const body = await request.text();
  const haiCoreRes = await client.fetchRaw(
    `/sonar/compliance/requests/obligations/${encodeURIComponent(params.id)}/decline`,
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
