import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/compliance/coverage/trend?window_days=
 * BFF passthrough to haiCore GET /sonar/compliance/coverage/trend.
 * Spec v1.34 Phase 6.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const raw = new URL(request.url).searchParams.get('window_days');
  const windowDays = raw !== null && raw !== '' && Number.isFinite(Number(raw)) ? Number(raw) : undefined;
  return NextResponse.json(await client.getCoverageTrend(windowDays));
});
