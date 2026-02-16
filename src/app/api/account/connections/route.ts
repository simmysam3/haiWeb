import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_ACCESS_REQUESTS } from "@/lib/mock-data";

/**
 * GET /api/account/connections
 *
 * Lists pending connection requests from haiCore. Falls back to mock data.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(MOCK_ACCESS_REQUESTS);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const requests = await client.listPendingRequests();
    return NextResponse.json(requests);
  } catch {
    return NextResponse.json(MOCK_ACCESS_REQUESTS);
  }
}

/**
 * POST /api/account/connections
 *
 * Requests a new connection via haiCore. Requires account_admin or higher.
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
    const { target_participant_id, message } = body;

    if (!target_participant_id) {
      return NextResponse.json(
        { error: "target_participant_id is required" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(
        { success: true, target_participant_id, status: "pending" },
        { status: 201 },
      );
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.requestConnection(target_participant_id, { message });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to request connection" },
      { status: 500 },
    );
  }
}
