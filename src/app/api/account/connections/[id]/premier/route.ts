import { withHaiCore } from "@/lib/with-hai-core";
import { forwardHaiCoreResponse } from "@/lib/forward-haicore-response";

/** PUT /api/account/connections/:id/premier — spec §3.2 (D). Body: { premier: boolean }. */
export const PUT = withHaiCore<{ id: string }>(
  async ({ client, request, params }) => {
    const body = await request.text();
    return forwardHaiCoreResponse(await client.fetchRaw(`/connections/${encodeURIComponent(params.id)}/premier`, { method: "PUT", headers: { "content-type": "application/json" }, body }));
  },
  { role: "account_admin" },
);
