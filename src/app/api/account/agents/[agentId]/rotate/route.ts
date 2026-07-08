import { withHaiCore } from "@/lib/with-hai-core";

export const POST = withHaiCore<{ agentId: string }>(
  ({ client, params }) => client.rotateAgentSecret(params.agentId),
  { role: "account_admin" },
);
