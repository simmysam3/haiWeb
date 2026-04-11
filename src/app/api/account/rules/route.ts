import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_APPROVAL_RULES } from "@/lib/mock-data";

/**
 * GET /api/account/rules
 *
 * Returns approval rules from haiCore. Falls back to mock data.
 */
export const GET = withHaiCore(
  ({ client }) => client.getApprovalRules(),
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
