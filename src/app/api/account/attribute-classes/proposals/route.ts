import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';

/** GET/POST /api/account/attribute-classes/proposals — spec §4.3, participant side. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/attribute-classes/proposals')));

export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = await request.text();
    return forwardHaiCoreResponse(await client.fetchRaw('/attribute-classes/proposals', { method: 'POST', headers: { 'content-type': 'application/json' }, body }));
  },
  { role: 'account_admin' },
);
