import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_APPROVAL_RULES } from "@/lib/mock-data";
import type { MockApprovalRules } from "@/lib/mock-types";

const EMPTY_BULK: MockApprovalRules["bulk"] = {
  publicly_traded: false,
  duns_verified: false,
  min_months_on_network: 0,
  min_score: 0,
  min_active_trading_pairs: 0,
  allowlist_ids: [],
};

const EMPTY_PER_REQUEST: MockApprovalRules["per_request"] = {
  min_score: 0,
  allowed_business_types: [],
  allowed_regions: [],
  blocklist_ids: [],
  default_posture: "manual_only",
};

const EMPTY_CONTACT: MockApprovalRules["contact"] = { email: "", phone: "" };

/**
 * haiCore returns {participant_id, bulk_criteria, per_request_rules, contact_route},
 * with each section nullable when no rules row exists yet. The UI consumes the
 * flatter MockApprovalRules shape ({bulk, per_request, contact}) and dereferences
 * nested fields directly, so we normalize at the BFF and substitute empty defaults
 * for null sections.
 */
function normalizeApprovalRules(raw: unknown): MockApprovalRules {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    bulk: (r.bulk_criteria as MockApprovalRules["bulk"]) ?? EMPTY_BULK,
    per_request: (r.per_request_rules as MockApprovalRules["per_request"]) ?? EMPTY_PER_REQUEST,
    contact: (r.contact_route as MockApprovalRules["contact"]) ?? EMPTY_CONTACT,
  };
}

/**
 * GET /api/account/rules
 *
 * Returns approval rules from haiCore, normalized to the UI shape.
 * Falls back to mock data when haiCore is unreachable.
 */
export const GET = withHaiCore(
  async ({ client }) => normalizeApprovalRules(await client.getApprovalRules()),
  { fallback: MOCK_APPROVAL_RULES },
);

/**
 * PUT /api/account/rules
 *
 * Updates approval rules via haiCore. Routes to the correct sub-endpoint
 * based on the `section` field in the body.
 * Body: { section: "bulk_criteria" | "per_request" | "contact_route", ...data }
 * Requires account_admin or higher.
 */
export const PUT = withHaiCore(
  async ({ client, request }) => {
    const body = await request.json();
    const { section, ...data } = body;

    if (!section) {
      return NextResponse.json(
        { error: "section field is required (bulk_criteria, per_request, or contact_route)" },
        { status: 400 },
      );
    }

    switch (section) {
      case "bulk_criteria":
        return client.updateBulkCriteria(data);
      case "per_request":
        return client.updatePerRequestRules(data);
      case "contact_route":
        // Contact route updates go through bulk criteria endpoint with contact data
        return client.updateBulkCriteria({ contact: data });
      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400 },
        );
    }
  },
  { role: "account_admin" },
);
