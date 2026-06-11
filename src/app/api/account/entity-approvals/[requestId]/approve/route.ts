import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/entity-approvals/[requestId]/approve
 *
 * Approves an inbound connection request to a tier. Body: { tier, reason? }.
 * Requires account_admin. haiCore's success status is 201 Created — preserved
 * here; 4xx errors (400 REASON_REQUIRED when gaps remain, 404 foreign/unknown
 * request) propagate verbatim via the wrapper.
 */
export const POST = withHaiCore<{ requestId: string }>(
  async ({ client, request, params }) => {
    const body = await request.json();
    const result = await client.approveEntity(params.requestId, body);
    return NextResponse.json(result, { status: 201 });
  },
  { role: "account_admin" },
);
