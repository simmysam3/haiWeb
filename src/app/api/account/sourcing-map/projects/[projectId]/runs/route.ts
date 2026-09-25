import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { projectId: string };

export const GET = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/projects/${seg(params.projectId)}/runs`),
  { role: 'account_admin' },
);
