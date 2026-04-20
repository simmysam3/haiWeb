import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/rules/test
 *
 * Tests approval rules against a hypothetical request via haiCore.
 * Body is forwarded directly.
 */
export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = await request.json();
    return client.testApprovalRules(body);
  },
  {
    fallback: {
      outcome: "auto_approve",
      matched_rules: ["bulk_criteria"],
      explanation:
        "Company meets all bulk pre-approval criteria (publicly traded, DUNS verified, behavioral score 92 >= 80, 8 months on network >= 6, 12 active trading pairs >= 10).",
    },
  },
);
