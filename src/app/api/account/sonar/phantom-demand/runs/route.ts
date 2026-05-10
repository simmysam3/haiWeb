import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET  /api/account/sonar/phantom-demand/runs — list the caller's PD runs.
 * POST /api/account/sonar/phantom-demand/runs — trigger a new ad-hoc PD probe.
 *
 * v1.30 PR-2 BFF passthrough (spec §7.6). Auth, scope checks, and probe-limit
 * enforcement all happen in haiCore. The BFF only adds the JWT + participant ctx.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const runs = await client.listPhantomDemandRuns({
    template_id: url.searchParams.get('template_id') ?? undefined,
    limit: url.searchParams.get('limit')
      ? Number(url.searchParams.get('limit'))
      : undefined,
  });
  return NextResponse.json(runs);
});

export const POST = withHaiCore(async ({ client, request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    scope: Record<string, unknown>;
    template_id?: string | null;
  };
  const result = await client.triggerPhantomDemand(body);
  return NextResponse.json(result, { status: 202 });
});
