import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/** GET/POST BFF → haiCore evidence annotations (v1.34 P8). */
export const GET = withHaiCore<{ draft_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.listEvidenceAnnotations(params.draft_id));
});

export const POST = withHaiCore<{ draft_id: string }>(async ({ client, params, request }) => {
  const body = await request.json();
  return NextResponse.json(
    await client.createEvidenceAnnotation(params.draft_id, body),
    { status: 201 },
  );
});
