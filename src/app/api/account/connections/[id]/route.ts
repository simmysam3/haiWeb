import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/connections/:id
 *
 * Approves or denies a connection request via haiCore.
 * Body: { action: "approve" | "deny" }
 * Requires account_admin or higher.
 */
export const POST = withHaiCore<{ id: string }>(
  async ({ client, request, params }) => {
    const body = await request.json();
    const { action } = body;

    if (action !== "approve" && action !== "deny") {
      return NextResponse.json(
        { error: "action must be 'approve' or 'deny'" },
        { status: 400 },
      );
    }

    return action === "approve"
      ? client.approveRequest(params.id)
      : client.denyRequest(params.id);
  },
  { role: "account_admin" },
);
