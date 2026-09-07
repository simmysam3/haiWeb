import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/counterparty-updates
 *
 * Returns the account_admin's counterparty-update review rows from haiCore.
 * Forwards the status / counterparty query params; unset keys are omitted so
 * haiCore applies its own defaults (status=pending). No fallback: a non-JWT
 * token must 401 rather than echo mock rows for this review surface.
 */
export const GET = withHaiCore(
  ({ client, request }) => {
    const sp = request.nextUrl.searchParams;
    return client.listCounterpartyUpdates({
      status: (sp.get("status") as "pending" | "decided" | "all" | null) ?? undefined,
      counterparty: sp.get("counterparty") ?? undefined,
    });
  },
  { role: "account_admin" },
);
