import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/sonar/compliance/requests/declined
 *
 * BFF passthrough to haiCore GET /sonar/compliance/requests/declined.
 * Default window: 30 days (?days=N to override, ?all=true for full history).
 * Spec v1.35 Task 18 / Task 27.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const daysRaw = sp.get('days');
  const days = daysRaw !== null ? Number(daysRaw) : undefined;
  const all = sp.get('all') === 'true';
  return NextResponse.json(await client.listDeclinedRequests({
    days: Number.isFinite(days) && (days as number) > 0 ? days : undefined,
    all: all ? true : undefined,
  }));
});
