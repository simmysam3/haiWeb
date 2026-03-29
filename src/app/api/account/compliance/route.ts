import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * GET /api/account/compliance
 *
 * Returns noncompliance report from haiCore.
 * Falls back to empty report on error.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ flags: [], total_count: 0, open_count: 0 });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const report = await client.getComplianceReport();

    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ flags: [], total_count: 0, open_count: 0 });
  }
}

/**
 * POST /api/account/compliance
 *
 * Triggers a self-audit via haiCore.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: false });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.triggerSelfAudit();

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false });
  }
}
