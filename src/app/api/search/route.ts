import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/search?q=<string>&limit=<number>
 *
 * BFF passthrough to haiCore GET /api/v1/search. Powers the top-nav global
 * search input + the /account/search results page.
 *
 * Validation is done server-side at haiCore (q.length >= 2, limit > 0). We
 * forward the raw query so error envelopes propagate verbatim. The client
 * component debounces at 250ms before calling.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sp = new URL(request.url).searchParams;
  const q = sp.get('q');
  if (q === null) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_PARAMETER',
          message: "'q' query parameter is required",
        },
      },
      { status: 400 },
    );
  }
  // Soft client-side guard so we don't burn a haiCore round-trip on the empty
  // string. haiCore will also reject; this saves the hop.
  if (q.trim().length < 2) {
    return NextResponse.json(
      { counterparties: [], skus: [], scopes: [] },
      { status: 200 },
    );
  }
  const limitRaw = sp.get('limit');
  const limit = limitRaw !== undefined && limitRaw !== null ? Number(limitRaw) : undefined;
  return NextResponse.json(
    await client.search(q, Number.isFinite(limit) ? (limit as number) : undefined),
  );
});
