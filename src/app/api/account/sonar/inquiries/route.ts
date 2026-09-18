import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

const DEFAULT_LIMIT = 50;

/**
 * GET /api/account/sonar/inquiries?direction=inbound|outbound&limit=&cursor=
 * The participant comes from the JWT via the participant-scoped `client`, never from the
 * query string. haiCore validates `direction`, `limit` (1..200) and `cursor`, and returns a
 * fixed 400 on any of them, propagated verbatim.
 *
 * PF P15 (ruling Q3): upstream requires the inquiry:ask scope, which the portal client does not
 * carry at 16b31655, so a 403 here is expected in production today. Map it to one fixed empty
 * state instead of an error the page cannot explain.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const params = request.nextUrl.searchParams;
  const qs = new URLSearchParams({
    direction: params.get('direction') ?? 'inbound',
    limit: params.get('limit') ?? String(DEFAULT_LIMIT),
  });
  const cursor = params.get('cursor');
  if (cursor) qs.set('cursor', cursor);
  const res = await client.fetchRaw(`/inquiries?${qs.toString()}`);
  if (res.status === 403) return NextResponse.json({ rows: [], next_cursor: null, not_enabled: true }, { status: 200 });
  return forwardHaiCoreResponse(res);
});
