import { withHaiCore } from "@/lib/with-hai-core";

/**
 * GET /api/account/compliance
 *
 * Returns noncompliance report from haiCore.
 * Falls back to empty report on error.
 */
export const GET = withHaiCore(
  ({ client }) => client.getComplianceReport(),
  { fallback: { flags: [], total_count: 0, open_count: 0 } },
);

/**
 * POST /api/account/compliance
 *
 * Triggers a self-audit via haiCore.
 */
export const POST = withHaiCore(
  ({ client }) => client.triggerSelfAudit(),
  { role: "account_admin" },
);
