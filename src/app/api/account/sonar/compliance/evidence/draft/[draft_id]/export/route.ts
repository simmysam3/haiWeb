import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/** POST BFF → haiCore POST /sonar/compliance/evidence/draft/:draft_id/export (v1.34 P9). */
export const POST = withHaiCore<{ draft_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.exportEvidence(params.draft_id), { status: 201 });
});
