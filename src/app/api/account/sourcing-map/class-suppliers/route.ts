import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

/** The seat's trading partners publishing a class or a descendant (pin picker, spec §7.2). */
export const GET = withHaiCore(({ client, request }) => smForward(client, request, '/sourcing-map/class-suppliers'), { role: 'account_admin' });
