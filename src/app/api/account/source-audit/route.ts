import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * POST /api/account/source-audit
 *
 * Runs an entity audit against haiCore's source-audit endpoint.
 * Falls back to mock data on error.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const token = await getToken();
    if (!token || !token.includes(".")) {
      console.warn("[source-audit] No valid token — returning mock data");
      return NextResponse.json({
        audit_id: "mock",
        nodes: [],
        audited_at: new Date().toISOString(),
        _debug: "no_token",
      });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.runEntityAudit(
      body.vendor_id,
      body.product_id,
      body.location_parameter ?? false,
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[source-audit] Error:", err instanceof Error ? err.message : err);
    return NextResponse.json({
      audit_id: "mock",
      nodes: [],
      audited_at: new Date().toISOString(),
      _debug: err instanceof Error ? err.message : "unknown_error",
    });
  }
}
