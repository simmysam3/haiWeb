import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { projectId: string };
const path = (p: P) => `/sourcing-map/projects/${seg(p.projectId)}`;

export const GET = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
/** Rename or archive. */
export const PATCH = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
/** Forwards `?disposition=` (D-206); a 409 execution_in_progress is relayed verbatim. */
export const DELETE = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
