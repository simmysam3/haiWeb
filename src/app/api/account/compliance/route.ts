import { withHaiCore } from "@/lib/with-hai-core";

const FORWARDED_KEYS = ["status", "page", "page_size", "reason_code", "vendor_id", "product_id", "from", "to"] as const;

/**
 * GET /api/account/compliance
 *
 * Returns noncompliance report from haiCore. Forwards status / pagination
 * query params so the dashboard can drive Open vs. Resolved tabs and 20-row
 * paging. Falls back to empty report on error.
 */
export const GET = withHaiCore(
  ({ client, request }) => {
    const url = new URL(request.url);
    const filters: Record<string, string> = {};
    for (const key of FORWARDED_KEYS) {
      const value = url.searchParams.get(key);
      if (value) filters[key] = value;
    }
    return client.getComplianceReport(filters);
  },
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
