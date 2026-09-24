import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { templateId: string };

export const GET = withHaiCore<P>(
  ({ client, request, params }) => smForward(client, request, `/sourcing-map/runs/${seg(params.templateId)}/executions`),
  { role: 'account_admin' },
);
