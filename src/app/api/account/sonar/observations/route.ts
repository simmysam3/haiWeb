import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';
import type { ObservationClass } from '@haiwave/protocol';

/**
 * GET /api/account/sonar/observations — unified observations list (v1.30 PR-4).
 *
 * BFF passthrough: forwards the querystring to haiCore's
 * GET /sonar/observations after session/auth resolution. The `tab`
 * querystring (audit | watcher | phantom_demand) is required; haiCore
 * uses it to select the correct underlying repository.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') as ObservationClass | null;
  if (!tab) {
    return NextResponse.json({ error: 'tab querystring required' }, { status: 400 });
  }
  const result = await client.listObservations({
    tab,
    status: url.searchParams.get('status') ?? undefined,
    date_range: url.searchParams.get('date_range') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    counterparty: url.searchParams.get('counterparty') ?? undefined,
  });
  return NextResponse.json(result);
});
