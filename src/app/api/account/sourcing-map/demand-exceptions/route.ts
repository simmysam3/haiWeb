import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

export const GET = withHaiCore(
  ({ client, request }) => smForward(client, request, '/sourcing-map/demand-exceptions'),
  { role: 'account_admin' },
);
