import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/working-list/gap-count-trend
 *
 * Backs the Gaps tab header strip on /sonar/audit/gaps with a daily-
 * resolution gap-count time series derived from existing
 * compliance_snapshots data (no new haiCore storage).
 *
 * Thin passthrough to haiCore. Forwards `?window=<days>` (clamped to
 * [7, 90] server-side, default 28).
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const raw = new URL(request.url).searchParams.get('window');
  const windowDays = raw !== null && raw !== '' ? Number(raw) : undefined;
  return NextResponse.json(
    await client.getGapCountTrend(Number.isFinite(windowDays) ? windowDays : undefined),
  );
});
