import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_PARTNERS } from "@/lib/mock-data";

/**
 * GET /api/account/partners
 *
 * Lists active connections (approved + trading_pair) from haiCore.
 * Falls back to mock data when haiCore is unreachable.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(MOCK_PARTNERS);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = (await client.listActiveConnections()) as {
      connections: Array<{
        connection_id: string;
        partner_participant_id: string;
        partner_name: string;
        partner_location: string;
        partner_industry: string;
        relationship_state: string;
        invite_yours: boolean;
        invite_theirs: boolean;
        established_at: string;
      }>;
    };

    // Map haiCore response to the shape the UI expects
    const partners = result.connections.map((c) => ({
      id: c.partner_participant_id,
      company_name: c.partner_name,
      status: c.relationship_state,
      manifest_progress: c.relationship_state === "trading_pair" ? 100 : 50,
      established_at: c.established_at,
      location: c.partner_location,
      industry: c.partner_industry,
      invite_yours: c.invite_yours,
      invite_theirs: c.invite_theirs,
      connection_id: c.connection_id,
    }));

    return NextResponse.json(partners);
  } catch {
    return NextResponse.json(MOCK_PARTNERS);
  }
}
