import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** Read-only reference data (the upstream serves adopted classes only) — no role gate. Consumed by Tasks 2 and 11. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/attribute-classes')));
