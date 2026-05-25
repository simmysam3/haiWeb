import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * POST /api/account/sonar/compliance/changes/[change_id]/process
 *
 * BFF passthrough to haiCore POST /sonar/compliance/changes/:id/process.
 * Marks the row as handled (severity critical → warning + processed_at/by).
 * Idempotent on haiCore — re-POST returns the row unchanged.
 * v.1.42 Events Process CTA.
 */
export const POST = withHaiCore<{ change_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.processComplianceChange(params.change_id));
});
