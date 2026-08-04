import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/quote-metrics?tz=<IANA>
 *
 * Volume counts for the System Dashboard, scoped to the session participant
 * as vendor. `tz` comes from the browser because `participants` carries no
 * timezone and the dashboard page is a Server Component that cannot read one.
 * Thin passthrough to `GET /quotes/metrics` (v1.66).
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const tz = new URL(request.url).searchParams.get('tz') ?? 'UTC';
  return NextResponse.json(await client.getQuoteMetrics(tz));
});
