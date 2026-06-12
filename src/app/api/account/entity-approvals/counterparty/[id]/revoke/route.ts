import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/entity-approvals/counterparty/[id]/revoke
 *
 * Withdraws a counterparty's tier and blocks the connection. Body:
 * { reason, outstanding_element_keys?, out_of_band_request? } — reason is
 * always mandatory upstream. Requires account_admin; 4xx propagate verbatim.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, request, params }) => client.revokeCounterparty(params.id, await request.json()),
  { role: "account_admin" },
);
