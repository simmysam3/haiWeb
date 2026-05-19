import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/compliance/evidence/draft/[draft_id]
 * BFF passthrough to haiCore GET /sonar/compliance/evidence/draft/:draft_id.
 * Spec v1.34 Phase 7.
 */
export const GET = withHaiCore<{ draft_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getEvidenceDraft(params.draft_id));
});
