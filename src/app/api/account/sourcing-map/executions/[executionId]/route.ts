import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { executionId: string };

export const GET = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/executions/${seg(params.executionId)}`),
  { role: 'account_admin' },
);
