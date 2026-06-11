import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/library/items/:id/affirm
 *
 * Affirms a library artifact or attribute as still current. Requires account_admin.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, params }) => client.affirmLibraryItem(params.id),
  { role: "account_admin" },
);
