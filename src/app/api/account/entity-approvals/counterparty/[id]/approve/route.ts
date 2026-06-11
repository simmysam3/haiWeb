import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/entity-approvals/counterparty/[id]/approve
 *
 * Proactively approves a counterparty to a tier. Body: { tier, reason? }.
 * If an inbound pending request exists haiCore resolves it; otherwise it
 * initiates an outbound pairing. Requires account_admin. haiCore returns 201;
 * 4xx (400 REASON_REQUIRED) propagate verbatim via the wrapper.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, request, params }) => {
    const body = await request.json();
    const result = await client.approveCounterparty(params.id, body);
    return NextResponse.json(result, { status: 201 });
  },
  { role: "account_admin" },
);
