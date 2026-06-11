import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/library/artifacts/from-existing
 *
 * Reuses an existing library document as evidence for another element.
 * Requires account_admin. Body: {element_key, source_artifact_id, title,
 * standard?, issuer?, cert_number?, scope?, valid_from?, valid_until?}.
 * haiCore 4xx (404 LIBRARY_SOURCE_ARTIFACT_NOT_FOUND, 400 unknown element)
 * propagate verbatim via the wrapper.
 */
export const POST = withHaiCore(
  async ({ client, request }) => client.createArtifactFromExisting(await request.json()),
  { role: "account_admin" },
);
