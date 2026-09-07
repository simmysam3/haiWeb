import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/counterparty-updates/sync-now
 *
 * Kicks off an immediate counterparty-updates sync against the owner's own
 * agent. Requires account_admin. No fallback: a non-JWT token must 401,
 * never fabricate a `started` response.
 */
export const POST = withHaiCore(
  ({ client }) => client.syncCounterpartyUpdatesNow(),
  { role: "account_admin" },
);
