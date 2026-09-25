import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { projectId: string };
const path = (p: P) => `/sourcing-map/projects/${seg(p.projectId)}/products`;

export const GET = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
export const POST = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
