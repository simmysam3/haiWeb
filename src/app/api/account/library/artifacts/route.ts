import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/library/artifacts
 *
 * Uploads a document-sourced artifact for a library element as
 * multipart/form-data. The FormData is passed through verbatim (no re-encode)
 * so the upstream multipart boundary is preserved. Requires account_admin.
 */
export const POST = withHaiCore(
  async ({ client, request }) => {
    const form = await request.formData();
    return client.uploadLibraryArtifact(form);
  },
  { role: "account_admin" },
);
