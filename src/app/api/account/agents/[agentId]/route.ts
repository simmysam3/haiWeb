import { NextRequest } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_AGENTS } from "@/lib/mock-data";

function mockAgentFor(agentId: string) {
  return MOCK_AGENTS.find((a) => a.id === agentId) ?? MOCK_AGENTS[0];
}

/**
 * GET /api/account/agents/:agentId
 *
 * Returns agent status from haiCore heartbeat endpoint. Falls back to mock agent data.
 */
export const GET = withHaiCore<{ agentId: string }>(
  ({ client, params }) => client.getAgentStatus(params.agentId),
  {
    fallback: (request: NextRequest) => {
      // Extract agentId from the URL path since params aren't passed to fallback
      const segments = request.nextUrl.pathname.split("/");
      const agentId = segments[segments.length - 1] ?? "";
      return mockAgentFor(agentId);
    },
  },
);
