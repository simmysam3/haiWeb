import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

export const GET = withHaiCore(
  ({ client, request }) => smForward(client, request, '/sourcing-map/supply-risks'),
  { role: 'account_admin' },
);
