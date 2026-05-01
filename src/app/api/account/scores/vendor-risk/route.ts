import { withHaiCore } from "@/lib/with-hai-core";
import type { VendorRiskDimension } from "@haiwave/protocol";

/**
 * GET /api/account/scores/vendor-risk?dimension=current|decline_acceleration&n=5
 *
 * Returns the caller's vendors stack-ranked by the requested dimension, with
 * each vendor's full N-quarter history embedded so the table can render
 * sparklines without a per-row fetch.
 */
export const GET = withHaiCore(async ({ client, request }) => {
  const rawDim = (request.nextUrl.searchParams.get("dimension") ?? "current").toLowerCase();
  const dimension: VendorRiskDimension =
    rawDim === "decline_acceleration" ? "decline_acceleration" : "current";
  const n = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("n") ?? "5") || 5));
  return client.getVendorRisk(dimension, n);
});
