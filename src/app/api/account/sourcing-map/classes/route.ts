import { withHaiCore } from '@/lib/with-hai-core';
import { smForward } from '@/lib/sourcing-map/bff';

/**
 * Class picker search (spec §7.2). GET /taxonomy/classes has no search
 * (apps/core/src/routes/taxonomy.ts:9-18, limit/offset only, cap 500), so
 * this targets GET /sourcing-map/classes?q=&limit= (d-G3; a-G11: limit 20 by
 * default, max 100, and an empty q returns no classes).
 */
export const GET = withHaiCore(({ client, request }) => smForward(client, request, '/sourcing-map/classes'), { role: 'account_admin' });
