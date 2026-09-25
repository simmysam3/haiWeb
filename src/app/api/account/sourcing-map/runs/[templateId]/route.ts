import { withHaiCore } from '@/lib/with-hai-core';
import { seg, smForward } from '@/lib/sourcing-map/bff';

type P = { templateId: string };
const path = (p: P) => `/sonar/templates/${seg(p.templateId)}`;

export const GET = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
/** Apply: scope and cadence. d-G2 makes a sourcing_map scope mutable; any 4xx is relayed verbatim. */
export const PATCH = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
/** Forwards the D-206 `?runs=<disposition>` (src/lib/haiwave-api.ts:791). */
export const DELETE = withHaiCore<P>(({ client, request, params }) => smForward(client, request, path(params)), { role: 'account_admin' });
