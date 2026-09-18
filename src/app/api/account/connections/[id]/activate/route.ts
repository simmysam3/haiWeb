import { withHaiCore } from "@/lib/with-hai-core";
import { forwardHaiCoreResponse } from "@/lib/forward-haicore-response";

/** POST /api/account/connections/:id/activate — D-146 closure (spec §3.3). */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, params }) => forwardHaiCoreResponse(await client.fetchRaw(`/connections/${encodeURIComponent(params.id)}/activate`, { method: "POST" })),
  { role: "account_admin" },
);
