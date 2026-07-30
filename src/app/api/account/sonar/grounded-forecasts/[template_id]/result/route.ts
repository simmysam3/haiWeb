import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/grounded-forecasts/[template_id]/result — the
 * template's latest stored forecast result.
 *
 * v1.62 BFF passthrough. A grounded forecast keeps only its most recent
 * result and keys it by template rather than by run, so this is the one read
 * the result page needs; haiCore 404s when no run has produced a document yet
 * and withHaiCore forwards that status verbatim.
 */
export const GET = withHaiCore<{ template_id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getGroundedForecastResult(params.template_id));
});
