import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_AGENTS } from "@/lib/mock-data";

/**
 * GET /api/account/agents/:agentId
 *
 * Returns agent status from haiCore heartbeat endpoint. Falls back to mock agent data.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentId } = await params;

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      const mockAgent = MOCK_AGENTS.find((a) => a.id === agentId) ?? MOCK_AGENTS[0];
      return NextResponse.json(mockAgent);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const status = await client.getAgentStatus(agentId);
    return NextResponse.json(status);
  } catch {
    const mockAgent = MOCK_AGENTS.find((a) => a.id === agentId) ?? MOCK_AGENTS[0];
    return NextResponse.json(mockAgent);
  }
}
