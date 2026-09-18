import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/**
 * GET /api/account/sonar/inquiries/:id — returns an InquiryVerdict or an InquiryPending body
 * (both 200) verbatim. Upstream answers one fixed 403 for "not yours", "no such inquiry" AND a
 * missing inquiry:ask scope; the three are indistinguishable by design (spec §13), so the BFF
 * maps all of them to the same not-enabled state (PF P15, ruling Q3).
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  const res = await client.fetchRaw(`/inquiries/${encodeURIComponent(params.id)}`);
  if (res.status === 403) return NextResponse.json({ not_enabled: true }, { status: 200 });
  return forwardHaiCoreResponse(res);
});
