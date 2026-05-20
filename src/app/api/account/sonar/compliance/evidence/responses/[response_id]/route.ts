import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/** GET BFF → haiCore GET /sonar/compliance/evidence/responses/:id (v1.34 P9). */
export const GET = withHaiCore<{ response_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getEvidenceResponse(params.response_id));
});
