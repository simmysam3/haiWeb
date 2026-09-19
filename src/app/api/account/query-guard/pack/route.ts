import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../_lib/authz';

/** GET/PUT /api/account/query-guard/pack — spec §10.6. PUT body: { pack: 'guarded'|'standard'|'open' }. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/query-guard/pack')));

export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw('/query-guard/pack', { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
