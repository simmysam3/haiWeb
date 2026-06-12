import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/entity-approvals
 *
 * Returns the reviewer's Entity Approvals queue from haiCore. Forwards the
 * status / search / sort query params; unset keys are omitted so haiCore
 * applies its own defaults (status=pending, sort=date_desc). Read-only — the
 * wrapper still session-gates.
 */
export const GET = withHaiCore(({ client, request }) => {
  const sp = request.nextUrl.searchParams;
  return client.entityApprovalsQueue({
    status: sp.get("status") ?? undefined,
    search: sp.get("search") ?? undefined,
    sort: sp.get("sort") ?? undefined,
  });
});
