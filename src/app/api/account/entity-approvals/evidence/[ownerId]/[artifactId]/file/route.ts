import { withHaiCore } from "@/lib/with-hai-core";
import { streamInlineSafe } from "@/lib/inline-safe-file";

/**
 * GET /api/account/entity-approvals/evidence/[ownerId]/[artifactId]/file
 *
 * Streams a counterparty's evidence document through from haiCore so a reviewer
 * can open it from the scorecard. Ownership + tier disclosure are enforced
 * core-side (D-49); this route only relays the bytes.
 */
export const GET = withHaiCore<{ ownerId: string; artifactId: string }>(async ({ client, params }) => {
  const upstream = await client.counterpartyEvidenceFile(params.ownerId, params.artifactId);
  return streamInlineSafe(upstream);
});
