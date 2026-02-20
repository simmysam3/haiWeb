import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * POST /api/account/connections/downgrade
 *
 * Downgrades a connection via haiCore (e.g. trading_pair -> approved).
 * Requires account_admin or higher.
 * Body: { connection_id: string, target_state: string }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { connection_id, target_state } = body;

    if (!connection_id) {
      return NextResponse.json(
        { error: "connection_id is required" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({
        success: true,
        connection_id,
        new_state: target_state ?? "approved",
      });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.downgradeConnection(connection_id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to downgrade connection" },
      { status: 500 },
    );
  }
}
