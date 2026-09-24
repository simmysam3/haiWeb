import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

/** A write (a-G14: run_template:write), gated like every other write. */
export const POST = withHaiCore(({ client, request }) => smForward(client, request, '/sourcing-map/supplier-matches'), { role: 'account_admin' });
