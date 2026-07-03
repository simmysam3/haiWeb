import { NextResponse } from "next/server";
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
 * Blocks a company via haiCore. Requires account_admin or higher. No
 * fallback: a non-JWT token (dev shim, or a poisoned/misconfigured cookie in
 * prod) must 401 rather than fabricate a "blocked" result.
 */
export const POST = withHaiCore(
  async ({ client, request }) => {
    const { target_participant_id } = await request.json();
    if (!target_participant_id) {
      return NextResponse.json(
        { error: "target_participant_id is required" },
        { status: 400 },
      );
    }
    const result = await client.blockParticipant(target_participant_id);
    return NextResponse.json(result, { status: 201 });
  },
  { role: "account_admin" },
);

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
