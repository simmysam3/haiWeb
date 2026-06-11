import { withHaiCore } from "@/lib/with-hai-core";

/**
 * PUT /api/account/library/policies
 *
 * Sets a share/require policy cell for a library element + tier.
 * Body: { element_key, context, tier, enabled }. Requires account_admin.
 */
export const PUT = withHaiCore(
  async ({ client, request }) => client.setLibraryPolicy(await request.json()),
  { role: "account_admin" },
);
