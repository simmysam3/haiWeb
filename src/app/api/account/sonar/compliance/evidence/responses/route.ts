import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/** GET BFF → haiCore GET /sonar/compliance/evidence/responses (v1.34 P9). */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.listEvidenceResponses());
});
