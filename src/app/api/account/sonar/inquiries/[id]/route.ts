import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/**
 * GET /api/account/sonar/inquiries/:id — returns an InquiryVerdict or an InquiryPending body
 * (both 200) verbatim. Upstream answers one fixed 403 for "not yours", "no such inquiry", a
 * missing inquiry:ask scope, AND a non-uuid :id (inquiries.ts:101-102 fails the uuid parse to the
 * same fixed 403 before any ownership check even runs); the four are indistinguishable by design
 * (spec §13), so the BFF maps all of them to the same not-enabled state (PF P15, ruling Q3). A
 * malformed or truncated link therefore renders the not-enabled state, not a not-found — that is
 * the intended behaviour, not a bug.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  const res = await client.fetchRaw(`/inquiries/${encodeURIComponent(params.id)}`);
  if (res.status === 403) return NextResponse.json({ not_enabled: true }, { status: 200 });
  return forwardHaiCoreResponse(res);
});
