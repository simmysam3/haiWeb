import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { productId: string };
const path = (p: P) => `/sourcing-map/products/${seg(p.productId)}`;

export const GET = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
export const PATCH = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
/** A 409 product_in_use carries SmProductInUse in error.details (a-G5); it is relayed verbatim. */
export const DELETE = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
