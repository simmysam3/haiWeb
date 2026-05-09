import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/watcher/runs/[id]/status — lightweight polling
 * shape (status only). v1.28 Phase 5 BFF passthrough.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  return NextResponse.json(await client.getWatcherRunStatus(params.id));
});
