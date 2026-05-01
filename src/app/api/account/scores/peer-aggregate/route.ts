import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/scores/peer-aggregate?n=5
 *
 * Returns the caller's vendor cohort averaged per quarter (oldest → newest).
 * Vendors are derived as active trading_relationships counterparties who have
 * published at least one origin_manifest.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const n = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("n") ?? "5") || 5));
  return client.getPeerAggregate(n);
});
