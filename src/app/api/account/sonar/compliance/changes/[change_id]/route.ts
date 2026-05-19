import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/compliance/changes/[change_id]
 *
 * BFF passthrough to haiCore GET /sonar/compliance/changes/:id.
 * Spec v1.34 Phase 4.
 */
export const GET = withHaiCore<{ change_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getComplianceChange(params.change_id));
});
