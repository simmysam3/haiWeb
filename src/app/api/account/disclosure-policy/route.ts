import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../query-guard/_lib/authz';

/** GET → { matrix }. PUT is FULL-REPLACE: the caller sends the whole cell (PF P5). */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/disclosure-policy')));

export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw('/disclosure-policy', { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
