import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/account/sonar/compliance/evidence/draft
 * BFF passthrough to haiCore POST /sonar/compliance/evidence/draft.
 * Spec v1.34 Phase 7.
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const body = await request.json();
  return NextResponse.json(await client.createEvidenceDraft(body));
});
