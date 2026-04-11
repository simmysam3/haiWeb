import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * PATCH /api/account/connections/:id/invite
 *
 * Updates the invite status on a connection via haiCore.
 * Body: { invite: boolean }
 * Requires account_admin or higher.
 */
export const PATCH = withHaiCore<{ id: string }>(
  async ({ client, request, params }) => {
    const body = await request.json();
    if (typeof body.invite !== "boolean") {
      return NextResponse.json(
        { error: "invite must be a boolean" },
        { status: 400 },
      );
    }
    return client.updateInvite(params.id, body.invite);
  },
  { role: "account_admin" },
);
