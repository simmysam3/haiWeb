import { withHaiCore } from "@/lib/with-hai-core";

/**
 * PUT /api/account/library/attributes/:elementKey
 *
 * Upserts the attribute value for a library element. Requires account_admin.
 */
export const PUT = withHaiCore<{ elementKey: string }>(
  async ({ client, request, params }) =>
    client.upsertLibraryAttribute(params.elementKey, await request.json()),
  { role: "account_admin" },
);
