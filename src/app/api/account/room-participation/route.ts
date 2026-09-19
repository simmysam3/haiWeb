import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../query-guard/_lib/authz';

/** GET → { global, per_class }. PUT takes one setting: { attribute_class_id: string | null, enabled }. */
export const GET = withHaiCore(async ({ client }) => forwardHaiCoreResponse(await client.fetchRaw('/room-participation')));

export const PUT = withHaiCore(async ({ client, request, session }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw('/room-participation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
