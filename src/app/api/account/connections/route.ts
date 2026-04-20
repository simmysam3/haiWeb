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
export const GET = withHaiCore(
  async ({ client }) => {
    const result = (await client.listPendingRequests()) as unknown as Array<{
      id: string;
      company_name?: string;
      contact_name?: string;
      message?: string;
      requested_at?: string;
      industry?: string;
      location?: string;
      business_type?: string;
      company_description?: string;
      behavioral_score?: number | null;
      product_lines?: string[];
      region?: string;
      network_member_since?: string | null;
      request_type?: "approved" | "trading_pair";
      invite?: boolean;
      age_days?: number;
    }>;

    // Map haiCore response to the shape the UI expects (MockAccessRequest)
    return result.map((r) => ({
      id: r.id,
      company_name: r.company_name ?? "",
      contact_name: r.contact_name ?? "",
      message: r.message ?? "",
      requested_at: r.requested_at ?? new Date().toISOString(),
      industry: r.industry ?? "",
      location: r.location ?? "",
      business_type: r.business_type ?? "",
      company_description: r.company_description ?? "",
      behavioral_score: r.behavioral_score ?? null,
      product_lines: r.product_lines ?? [],
      region: r.region ?? "",
      network_member_since: r.network_member_since ?? null,
      request_type: r.request_type ?? "approved",
      invite: r.invite ?? false,
      age_days: r.age_days ?? 0,
    }));
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
