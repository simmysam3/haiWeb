import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/entity-approvals/counterparty/[id]/scorecard
 *
 * Live compliance scorecard for a counterparty with no inbound request
 * (proactive review), recomputed at the optional `tier` query. Read-only.
 */
export const GET = withHaiCore<{ id: string }>(({ client, request, params }) =>
  client.counterpartyScorecard(params.id, request.nextUrl.searchParams.get("tier") ?? undefined),
);
