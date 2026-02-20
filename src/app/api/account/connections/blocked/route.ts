import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_BLOCKED_COMPANIES } from "@/lib/mock-data";

/**
 * GET /api/account/connections/blocked
 *
 * Lists blocked companies from haiCore. Falls back to mock data.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(MOCK_BLOCKED_COMPANIES);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const blocked = await client.listBlocked();
    return NextResponse.json(blocked);
  } catch {
    return NextResponse.json(MOCK_BLOCKED_COMPANIES);
  }
}

/**
 * POST /api/account/connections/blocked
 *
 * Blocks a company via haiCore. Requires account_admin or higher.
 * Body: { target_participant_id: string }
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
    const { target_participant_id } = body;

    if (!target_participant_id) {
      return NextResponse.json(
        { error: "target_participant_id is required" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(
        { success: true, target_participant_id, status: "blocked" },
        { status: 201 },
      );
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.blockParticipant(target_participant_id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to block company" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/account/connections/blocked
 *
 * Unblocks a company via haiCore. Requires account_admin or higher.
 * Query: ?blocked_participant_id=xxx
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const blockedParticipantId = request.nextUrl.searchParams.get("blocked_participant_id");

    if (!blockedParticipantId) {
      return NextResponse.json(
        { error: "blocked_participant_id query parameter is required" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, unblocked: blockedParticipantId });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.unblockParticipant(blockedParticipantId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to unblock company" },
      { status: 500 },
    );
  }
}
