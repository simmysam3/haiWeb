import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/watcher/triage-alerts — placeholder. Returns an empty
 * alerts array until drift threshold logic ships on haiCore (spec §10 open
 * question). Keeps the <NeedsTriageStrip> surface working today; it renders
 * nothing while the response is [].
 */
export const GET = withHaiCore(async () => {
  return NextResponse.json({ alerts: [] });
});
