import { NextResponse } from 'next/server';
import type { PhantomDemandWindow } from '@haiwave/protocol';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/dashboard/phantom-demand-aggregate
 *
 * Returns per-counterparty PD posture (response_rate, median latency,
 * completeness distribution) for the requested window.
 *
 * Mirrors the audit aggregate shape; computed by haiCore from
 * phantom_demand_results joined to phantom_demand_runs.
 *
 * v1.30 PR-2, spec §7.7. Auth delegated to withHaiCore.
 */

const ALLOWED_WINDOWS = new Set<PhantomDemandWindow>(['24h', '7d', '30d', '90d']);

function isPhantomDemandWindow(v: string | null): v is PhantomDemandWindow {
  return v !== null && ALLOWED_WINDOWS.has(v as PhantomDemandWindow);
}

export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const windowParam = url.searchParams.get('window');
  const window: PhantomDemandWindow = isPhantomDemandWindow(windowParam)
    ? windowParam
    : '7d';
  const aggregate = await client.getPhantomDemandAggregate({ window });
  return NextResponse.json(aggregate);
});
