import { NextRequest, NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_PRICING_HIERARCHY } from "@/lib/mock-data";

/**
 * GET /api/account/pricing
 *
 * Returns the pricing hierarchy for the current participant. Falls back to mock data.
 */
export const GET = withHaiCore(
  ({ client, session }) => client.getPricingHierarchy(session.participant.id),
  { fallback: MOCK_PRICING_HIERARCHY },
);

/**
 * PUT /api/account/pricing
 *
 * Upserts a pricing level via haiCore. Body is forwarded directly.
 */
export const PUT = withHaiCore(
  async ({ client, request }) => {
    const body = await request.json();
    return client.upsertPricingLevel(body);
  },
  {
    fallback: async (request: NextRequest) => {
      const body = await request.json();
      return { success: true, ...body };
    },
  },
);

/**
 * DELETE /api/account/pricing?manifest_id=xxx
 *
 * Deletes a pricing level via haiCore.
 */
export const DELETE = withHaiCore(async ({ client, request }) => {
  const manifestId = request.nextUrl.searchParams.get("manifest_id");
  if (!manifestId) {
    return NextResponse.json(
      { error: "manifest_id query parameter is required" },
      { status: 400 },
    );
  }
  return client.deletePricingLevel(manifestId);
});
