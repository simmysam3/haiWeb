import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/watcher/runs/[id]/trailing-history — the anchor run's
 * watcher plus the last N runs of it and every result across them, for the
 * readiness run-detail page's SKU->vendor lead-time series. BFF passthrough to
 * core GET /sonar/watcher/runs/:id/trailing-history.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getWatcherTrailingHistory(params.id));
});
