import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/compliance/coverage/trend?window_days=
 * BFF passthrough to haiCore GET /sonar/compliance/coverage/trend.
 * Spec v1.34 Phase 6.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const raw = new URL(request.url).searchParams.get('window_days');
  // A present-but-non-finite window_days must surface haiCore's tested
  // 400 INVALID_PARAMETER path rather than being silently coerced to the
  // default. Absent / empty string still means "use default" (haiCore 90).
  if (raw !== null && raw !== '' && !Number.isFinite(Number(raw))) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_PARAMETER',
          message: `'window_days' must be a number, got: ${raw}`,
          timestamp: new Date().toISOString(),
          request_id: 'bff',
        },
      },
      { status: 400 },
    );
  }
  const windowDays = raw !== null && raw !== '' ? Number(raw) : undefined;
  return NextResponse.json(await client.getCoverageTrend(windowDays));
});
