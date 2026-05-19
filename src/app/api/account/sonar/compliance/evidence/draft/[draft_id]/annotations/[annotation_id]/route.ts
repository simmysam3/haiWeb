import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/** PATCH BFF → haiCore PATCH evidence annotation (new version) (v1.34 P8). */
export const PATCH = withHaiCore<{ draft_id: string; annotation_id: string }>(
  async ({ client, params, request }) => {
    const body = await request.json();
    return NextResponse.json(
      await client.patchEvidenceAnnotation(params.draft_id, params.annotation_id, body),
    );
  });
