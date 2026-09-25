import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

/** The seat's finished goods from origin_manifests (spec §17 R-6, contract §2). */
export const GET = withHaiCore(({ client, request }) => smForward(client, request, '/sourcing-map/agent-parent-skus'), { role: 'account_admin' });
