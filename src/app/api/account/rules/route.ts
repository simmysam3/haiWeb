import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_APPROVAL_RULES } from "@/lib/mock-data";

/**
 * GET /api/account/rules
 *
 * Returns approval rules from haiCore. Falls back to mock data.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(MOCK_APPROVAL_RULES);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const rules = await client.getApprovalRules();
    return NextResponse.json(rules);
  } catch {
    return NextResponse.json(MOCK_APPROVAL_RULES);
  }
}

/**
 * PUT /api/account/rules
 *
 * Updates approval rules via haiCore. Routes to the correct sub-endpoint
 * based on the `section` field in the body.
 * Body: { section: "bulk_criteria" | "per_request" | "contact_route", ...data }
 * Requires account_admin or higher.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { section, ...data } = body;

    if (!section) {
      return NextResponse.json(
        { error: "section field is required (bulk_criteria, per_request, or contact_route)" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, section, ...data });
    }

    const client = createHaiwaveClient(token, session.participant.id);

    switch (section) {
      case "bulk_criteria": {
        const result = await client.updateBulkCriteria(data);
        return NextResponse.json(result);
      }
      case "per_request": {
        const result = await client.updatePerRequestRules(data);
        return NextResponse.json(result);
      }
      case "contact_route": {
        // Contact route updates go through bulk criteria endpoint with contact data
        const result = await client.updateBulkCriteria({ contact: data });
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400 },
        );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update approval rules" },
      { status: 500 },
    );
  }
}
