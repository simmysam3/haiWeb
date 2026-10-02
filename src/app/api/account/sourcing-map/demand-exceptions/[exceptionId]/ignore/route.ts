import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { exceptionId: string };

export const POST = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/demand-exceptions/${seg(params.exceptionId)}/ignore`),
  { role: 'account_admin' },
);
