import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { ProcessComplianceChangeRequest } from '@haiwave/protocol';

/**
 * POST /api/account/sonar/compliance/changes/[change_id]/process
 *
 * BFF passthrough to haiCore POST /sonar/compliance/changes/:id/process.
 * Body { outcome, description? } is parsed + validated at haiCore.
 * v.1.42 Outcome form.
 */
export const POST = withHaiCore<{ change_id: string }>(async ({ client, request, params }) => {
  const body = (await request.json()) as ProcessComplianceChangeRequest;
  return NextResponse.json(await client.processComplianceChange(params.change_id, body));
});
