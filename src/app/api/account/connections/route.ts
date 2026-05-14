import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_ACCESS_REQUESTS } from "@/lib/mock-data";

/**
 * GET /api/account/connections
 *
 * Lists pending connection requests from haiCore. Falls back to mock data.
 */
interface HaiCorePendingRow {
  id: string;
  requesting_participant_id?: string;
  requesting_name?: string;
  requested_level?: "approved" | "trading_pair";
  invite?: boolean;
  context_message?: string | null;
  requested_at?: string;
}

function ageDays(requestedAt: string): number {
  const ms = Date.now() - new Date(requestedAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/**
 * GET /api/account/connections
 *
 * Lists pending connection requests from haiCore. Maps haiCore's
 * {requesting_name, context_message, requested_level, ...} shape onto the
 * flatter MockAccessRequest the UI consumes. haiCore doesn't currently return
 * the rich profile fields the queue card displays (industry, behavioral_score,
 * product_lines); those degrade gracefully to empty values until profile
 * enrichment is added to /connections/pending.
 *
 * Falls back to mock data when haiCore is unreachable.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    const rows = (await client.listPendingRequests()) as unknown as HaiCorePendingRow[];

    return rows.map((r) => {
      const requestedAt = r.requested_at ?? new Date().toISOString();
      return {
        id: r.id,
        company_name: r.requesting_name ?? "Unknown participant",
        contact_name: "",
        message: r.context_message ?? "",
        requested_at: requestedAt,
        industry: "",
        location: "",
        business_type: "",
        company_description: "",
        behavioral_score: null,
        product_lines: [],
        region: "",
        network_member_since: null,
        request_type: r.requested_level ?? "approved",
        invite: r.invite ?? false,
        age_days: ageDays(requestedAt),
      };
    });
  },
  { fallback: MOCK_ACCESS_REQUESTS },
);

/**
 * POST /api/account/connections
 *
 * Requests a new connection via haiCore. Requires account_admin or higher.
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
