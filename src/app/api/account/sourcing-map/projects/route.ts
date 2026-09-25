import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

/** /api/account/sourcing-map/projects → /api/v1/sourcing-map/projects (contract §6.1–6.2). */
export const GET = withHaiCore(({ client, request }) => smForward(client, request, '/sourcing-map/projects'), { role: 'account_admin' });
export const POST = withHaiCore(({ client, request }) => smForward(client, request, '/sourcing-map/projects'), { role: 'account_admin' });
