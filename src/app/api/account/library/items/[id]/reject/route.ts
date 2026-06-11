import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/library/items/:id/reject
 *
 * Rejects (hard-deletes) a draft library artifact or attribute. Requires
 * account_admin. haiCore returns 404 for non-draft/unknown items, which the
 * wrapper propagates verbatim.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, params }) => client.rejectLibraryItem(params.id),
  { role: "account_admin" },
);
