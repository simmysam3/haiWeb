import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_PRICING_HIERARCHY } from "@/lib/mock-data";

/**
 * GET /api/account/pricing
 *
 * Returns the pricing hierarchy for the current participant. Falls back to mock data.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(MOCK_PRICING_HIERARCHY);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const hierarchy = await client.getPricingHierarchy(session.participant.id);
    return NextResponse.json(hierarchy);
  } catch {
    return NextResponse.json(MOCK_PRICING_HIERARCHY);
  }
}

/**
 * PUT /api/account/pricing
 *
 * Upserts a pricing level via haiCore.
 * Body is forwarded directly.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, ...body });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.upsertPricingLevel(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update pricing level" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/account/pricing
 *
 * Deletes a pricing level via haiCore.
 * Query: ?manifest_id=xxx
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const manifestId = request.nextUrl.searchParams.get("manifest_id");

    if (!manifestId) {
      return NextResponse.json(
        { error: "manifest_id query parameter is required" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, deleted: manifestId });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.deletePricingLevel(manifestId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete pricing level" },
      { status: 500 },
    );
  }
}
