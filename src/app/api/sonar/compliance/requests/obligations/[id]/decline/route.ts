import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/sonar/compliance/requests/obligations/[id]/decline
 *
 * BFF passthrough to haiCore POST /sonar/compliance/requests/obligations/:id/decline.
 * Body: { reason?: string } (≤ 2000 chars). 204 on success; 400/404 forwarded
 * verbatim. Spec v1.35 Task 18.
 *
 * SF-3 (v1.35 PR review): body-read + fetch are wrapped in try/catch so
 * network-level failures (ECONNREFUSED, DNS, timeout, stream interrupt)
 * surface as a curated 502, never leaking infrastructure details to the UI.
 */
export const POST = withHaiCore<{ id: string }>(async ({ client, request, params }) => {
  let body: string;
  try {
    body = await request.text();
  } catch (e) {
    console.warn('[BFF requests/obligations/decline] body-read failed', e);
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Could not read request body' } },
      { status: 400 },
    );
  }

  let haiCoreRes: Response;
  try {
    haiCoreRes = await client.fetchRaw(
      `/sonar/compliance/requests/obligations/${encodeURIComponent(params.id)}/decline`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body || '{}',
      },
    );
  } catch (e) {
    console.warn('[BFF requests/obligations/decline] network error', e);
    return NextResponse.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: 'Could not reach compliance service' } },
      { status: 502 },
    );
  }

  if (haiCoreRes.status === 204) return new NextResponse(null, { status: 204 });
  const text = await haiCoreRes.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return NextResponse.json(parsed, { status: haiCoreRes.status });
}, { role: 'account_admin' });
