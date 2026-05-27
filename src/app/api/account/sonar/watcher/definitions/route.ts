import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/watcher/definitions — list the caller's watcher
 * RunTemplates. v1.43 (Plan 2) BFF, mirrors /api/account/sonar/audit/definitions.
 *
 * haiCore's listRunTemplates returns ALL templates regardless of
 * observation_class. This BFF filters server-side to observation_class='watcher'
 * so HaiWeb watcher pages don't have to discriminate every consumer.
 */
export const GET = withHaiCore(async ({ client }) => {
  const { templates } = await client.listRunTemplates();
  const watcherTemplates = templates.filter(
    (t) => t.observation_class === 'watcher',
  );
  return NextResponse.json({ templates: watcherTemplates });
});
