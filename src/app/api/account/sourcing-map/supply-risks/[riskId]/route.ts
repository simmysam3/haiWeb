import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { riskId: string };

export const PATCH = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/supply-risks/${seg(params.riskId)}`),
  { role: 'account_admin' },
);
