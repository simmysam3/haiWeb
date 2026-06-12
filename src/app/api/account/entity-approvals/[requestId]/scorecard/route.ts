import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/entity-approvals/[requestId]/scorecard
 *
 * Live compliance scorecard for an inbound connection request, recomputed at
 * the optional `tier` query (the reviewer's tier picker drives it). Read-only.
 */
export const GET = withHaiCore<{ requestId: string }>(({ client, request, params }) =>
  client.entityApprovalScorecard(params.requestId, request.nextUrl.searchParams.get("tier") ?? undefined),
);
