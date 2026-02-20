import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * POST /api/account/connections/:id
 *
 * Approves or denies a connection request via haiCore.
 * Body: { action: "approve" | "deny" }
 * Requires account_admin or higher.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { action } = body;

    if (action !== "approve" && action !== "deny") {
      return NextResponse.json(
        { error: "action must be 'approve' or 'deny'" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, id, action });
    }

    const client = createHaiwaveClient(token, session.participant.id);

    if (action === "approve") {
      const result = await client.approveRequest(id);
      return NextResponse.json(result);
    } else {
      const result = await client.denyRequest(id);
      return NextResponse.json(result);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process connection request" },
      { status: 500 },
    );
  }
}
