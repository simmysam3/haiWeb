import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/sonar/compliance/requests/counts
 *
 * BFF passthrough to haiCore GET /sonar/compliance/requests/counts.
 * Hot path for the sidebar nav badge (Task 20). Returns total + per-direction
 * counts + oldest awaiting-me age. Spec v1.35 Task 18.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getRequestCounts());
});
