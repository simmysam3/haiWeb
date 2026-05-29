import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * DELETE /api/account/aliases/:aliasId
 *
 * Removes one of the signed-in participant's aliases. Requires account_admin.
 */
export const DELETE = withHaiCore<{ aliasId: string }>(
  async ({ client, session, params }) => {
    await client.removeAlias(session.participant.id, params.aliasId);
    return NextResponse.json({ success: true });
  },
  { role: "account_admin" },
);
