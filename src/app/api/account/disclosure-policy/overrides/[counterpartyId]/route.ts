import { withHaiCore } from '@/lib/with-hai-core';
import { forwardHaiCoreResponse } from '@/lib/forward-haicore-response';
import { forbidNonEditor } from '../../../query-guard/_lib/authz';

/**
 * PUT /api/account/disclosure-policy/overrides/:counterpartyId — spec §5.1, reached from Task 2's page.
 * The override is keyed (counterparty × attribute class): the body is
 * { attribute_class_id, disclosure, disclose_shortfall_quantity } and carries NO trust_class.
 * `counterpartyId` is a participant uuid upstream; the page passes the partner row's id.
 */
export const PUT = withHaiCore<{ counterpartyId: string }>(async ({ client, request, session, params }) => {
  const forbidden = forbidNonEditor(session);
  if (forbidden) return forbidden;
  const body = await request.text();
  return forwardHaiCoreResponse(await client.fetchRaw(`/disclosure-policy/overrides/${encodeURIComponent(params.counterpartyId)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body }));
});
