import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/pricing/bulk
 *
 * Bulk uploads pricing entries via haiCore.
 */
export const POST = withHaiCore(async ({ client, request }) => {
  const body = await request.json();
  if (!body.entries || !Array.isArray(body.entries)) {
    return NextResponse.json(
      { error: "entries array is required" },
      { status: 400 },
    );
  }
  return client.bulkUploadPricing(body.entries);
});
