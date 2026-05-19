import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/account/sonar/compliance/evidence/draft/[draft_id]/dispatch
 * BFF passthrough to haiCore POST /sonar/compliance/evidence/draft/:draft_id/dispatch.
 * Spec v1.34 Phase 7.
 */
export const POST = withHaiCore<{ draft_id: string }>(async ({ client, params, request }) => {
  const body = await request.json();
  return NextResponse.json(await client.dispatchEvidenceDraft(params.draft_id, body));
});
