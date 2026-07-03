import { withHaiCore } from "@/lib/with-hai-core";
import { streamInlineSafe } from "@/lib/inline-safe-file";

/**
 * GET /api/account/library/artifacts/[id]/file
 *
 * Streams a library document artifact's file through from haiCore. No role gate
 * — viewing your own documents isn't admin-only; the wrapper still session-gates.
 */
export const GET = withHaiCore<{ id: string }>(async ({ client, params }) => {
  const upstream = await client.getLibraryArtifactFile(params.id);
  return streamInlineSafe(upstream);
});
