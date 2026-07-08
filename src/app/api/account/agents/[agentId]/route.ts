import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/agents/:agentId
 *
 * Returns agent status from the haiCore heartbeat endpoint. The dev-only
 * fallback is null (no fabricated agent) — there is no real agent to stand in
 * for when haiCore is unavailable.
 */
export const GET = withHaiCore<{ agentId: string }>(
  ({ client, params }) => client.getAgentStatus(params.agentId),
  { fallback: null },
);
