import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * POST /api/account/rules/test
 *
 * Tests approval rules against a hypothetical request via haiCore.
 * Body is forwarded directly.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const token = await getToken();
    if (!token || !token.includes(".")) {
      // Mock test result
      return NextResponse.json({
        outcome: "auto_approve",
        matched_rules: ["bulk_criteria"],
        explanation: "Company meets all bulk pre-approval criteria (publicly traded, DUNS verified, behavioral score 92 >= 80, 8 months on network >= 6, 12 active trading pairs >= 10).",
      });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.testApprovalRules(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to test approval rules" },
      { status: 500 },
    );
  }
}
