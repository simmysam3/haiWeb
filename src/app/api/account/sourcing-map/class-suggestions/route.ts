import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

/** Component labels only — never part references ([D-j], spec §8.8). A write (a-G14: run_template:write). The wizard builds the body (Task 32). */
export const POST = withHaiCore(({ client, request }) => smForward(client, request, '/sourcing-map/class-suggestions'), { role: 'account_admin' });
