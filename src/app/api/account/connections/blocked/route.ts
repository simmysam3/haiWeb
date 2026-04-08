import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_BLOCKED_COMPANIES } from "@/lib/mock-data";

/**
 * GET /api/account/connections/blocked
 *
 * Lists blocked companies from haiCore. Falls back to mock data.
 */
export const GET = withHaiCore(
  ({ client }) => client.listBlocked(),
  { fallback: MOCK_BLOCKED_COMPANIES },
);

/**
 * POST /api/account/connections/blocked
 *
 * Blocks a company via haiCore. Requires account_admin or higher.
 * Returns 201 on success, so kept outside withHaiCore to preserve semantics.
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
 * DELETE /api/account/connections/blocked?blocked_participant_id=xxx
 *
 * Unblocks a company via haiCore. Requires account_admin or higher.
 */
export const DELETE = withHaiCore(
  async ({ client, request }) => {
    const blockedParticipantId = request.nextUrl.searchParams.get("blocked_participant_id");
    if (!blockedParticipantId) {
      return NextResponse.json(
        { error: "blocked_participant_id query parameter is required" },
        { status: 400 },
      );
    }
    return client.unblockParticipant(blockedParticipantId);
  },
  {
    role: "account_admin",
  },
);
