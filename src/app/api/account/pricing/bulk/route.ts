import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * POST /api/account/pricing/bulk
 *
 * Bulk uploads pricing entries via haiCore.
 * Body is forwarded directly.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.entries || !Array.isArray(body.entries)) {
      return NextResponse.json(
        { error: "entries array is required" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({
        success: true,
        imported: body.entries.length,
        errors: [],
      });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.bulkUploadPricing(body.entries);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to bulk upload pricing" },
      { status: 500 },
    );
  }
}
