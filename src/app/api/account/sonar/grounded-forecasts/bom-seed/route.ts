import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/grounded-forecasts/bom-seed?sku= — the wizard's BOM
 * seed: the caller's own agent's bill of materials for a nominated analogue,
 * already mapped to editable forecast lines.
 *
 * v1.62 BFF passthrough. A missing or unreachable BOM is haiCore's 404
 * BOM_UNAVAILABLE, forwarded verbatim by withHaiCore — the wizard treats it as
 * a prompt for manual entry, never as a dead end (spec §9). The only thing
 * decided here is that an absent sku is the caller's error, not a probe.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const sku = new URL(request.url).searchParams.get('sku');
  if (!sku) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'sku is required' } },
      { status: 400 },
    );
  }
  return NextResponse.json(await client.getGroundedForecastBomSeed(sku));
});
