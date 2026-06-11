import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/library/artifacts/url
 *
 * Registers a URL-sourced artifact for a library element. Requires account_admin.
 */
export const POST = withHaiCore(
  async ({ client, request }) => client.createLibraryUrlArtifact(await request.json()),
  { role: "account_admin" },
);
