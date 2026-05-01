import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/scores/quarterly?n=5
 *
 * Returns the caller's last N quarterly behavioral scores (oldest → newest),
 * with the partial in-progress quarter as the final entry.
 */
export const GET = withHaiCore(async ({ client, session, request }) => {
  const n = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("n") ?? "5") || 5));
  return client.getQuarterlyScores(session.participant.id, n);
});
