import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/library/artifacts/from-existing
 *
 * Reuses an existing library document as evidence for another element.
 * Requires account_admin. Body: {element_key, source_artifact_id, title,
 * standard?, issuer?, cert_number?, scope?, valid_from?, valid_until?}.
 * haiCore 4xx propagate verbatim via the wrapper: 404 {error:{code:'NOT_FOUND'}}
 * for a missing/foreign/draft source (haiCore maps SourceArtifactNotFoundError
 * to the generic NOT_FOUND wire code, like every library route); 400 for an
 * unknown element.
 */
export const POST = withHaiCore(
  async ({ client, request }) => client.createArtifactFromExisting(await request.json()),
  { role: "account_admin" },
);
