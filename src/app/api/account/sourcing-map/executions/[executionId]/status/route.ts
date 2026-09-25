import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { executionId: string };

/** Progressive results: candidates changed since ?cursor= (spec §8.9). */
export const GET = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/executions/${seg(params.executionId)}/status`),
  { role: 'account_admin' },
);
