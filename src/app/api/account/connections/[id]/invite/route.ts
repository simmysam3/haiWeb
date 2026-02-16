import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * PATCH /api/account/connections/:id/invite
 *
 * Updates the invite status on a connection via haiCore.
 * Body: { invite: boolean }
 * Requires account_admin or higher.
 */
export async function PATCH(
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
    const { invite } = body;

    if (typeof invite !== "boolean") {
      return NextResponse.json(
        { error: "invite must be a boolean" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, id, invite });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.updateInvite(id, invite);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update invite status" },
      { status: 500 },
    );
  }
}
