import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/compliance/coverage/current
 * BFF passthrough to haiCore GET /sonar/compliance/coverage/current.
 * Spec v1.34 Phase 6.
 */
export const GET = withHaiCore(async ({ client }) => {
  return NextResponse.json(await client.getCoverageCurrent());
});
