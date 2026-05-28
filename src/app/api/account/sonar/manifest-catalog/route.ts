import { NextResponse } from 'next/server';
import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/sonar/manifest-catalog — v.1.43 Plan 3 E5
 *
 * Returns the AUTHENTICATED BUYER's own origin-manifest catalog flattened to
 *   { products: Array<{ external_product_id: string; product_name: string }> }
 *
 * Consumed by the watcher run-detail page (E3 — two-level vendor → product
 * grid) to enrich per-product result rows with human-readable product names
 * without round-tripping per row.
 *
 * Why a dedicated endpoint rather than reusing /api/account/provenance:
 *   - /api/account/provenance returns one page (default 20) of summaries
 *     bundled with the certifications envelope; it's optimised for the
 *     Provenance tab, not a name-lookup map. This route walks all pages
 *     server-side and emits just the (id, name) projection so the client
 *     can build a Map<external_product_id, product_name> with a single fetch.
 *
 * Falls back to an empty product list so the run-detail page can degrade
 * gracefully to bare external_product_id rendering.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    const result = await client.listManifestCatalog();
    return NextResponse.json(result);
  },
  { fallback: { products: [] } },
);
