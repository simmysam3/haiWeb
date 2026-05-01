import { withHaiCore } from '@/lib/with-hai-core';

/**
 * GET /api/account/provenance/manifests/{productId}
 *
 * Returns the full origin manifest for a single product. 404 surfaces as the
 * standard withHaiCore 4xx propagation envelope.
 */
export const GET = withHaiCore<{ productId: string }>(
  ({ client, params }) => client.getOriginManifest(params.productId),
);
