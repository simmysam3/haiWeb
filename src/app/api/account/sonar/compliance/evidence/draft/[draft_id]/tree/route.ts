import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/** GET BFF → haiCore GET /sonar/compliance/evidence/draft/:draft_id/tree (v1.34 P8). */
export const GET = withHaiCore<{ draft_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getEvidenceTree(params.draft_id));
});
