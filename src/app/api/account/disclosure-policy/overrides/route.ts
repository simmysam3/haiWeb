import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** GET /api/account/disclosure-policy/overrides — a read, so no role gate. Consumed by Task 2's ?counterparty= view. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/disclosure-policy/overrides')));
