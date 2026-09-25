import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { productId: string };

/** Copy or link the seat agent's BOM (spec §7.5). fetchRaw never throws, so a 502 is relayed as-is. */
export const POST = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/products/${seg(params.productId)}/import-agent-bom`),
  { role: 'account_admin' },
);
