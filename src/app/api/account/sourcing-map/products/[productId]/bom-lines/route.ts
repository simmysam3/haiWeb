import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { productId: string };

/** Replaces the product's lines in one haiCore transaction (spec §7.3 step 4). */
export const PUT = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/products/${seg(params.productId)}/bom-lines`),
  { role: 'account_admin' },
);
