import { NextRequest, NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/connections/downgrade
 *
 * Downgrades a connection via haiCore (e.g. trading_pair -> approved).
 * Body: { connection_id: string, target_state: string }
 * Requires account_admin or higher.
 */
export const POST = withHaiCore(
  async ({ client, request }) => {
    const body = await request.json();
    if (!body.connection_id) {
      return NextResponse.json(
        { error: "connection_id is required" },
        { status: 400 },
      );
    }
    return client.downgradeConnection(body.connection_id);
  },
  {
    role: "account_admin",
    fallback: async (request: NextRequest) => {
      const body = await request.json();
      return {
        success: true,
        connection_id: body.connection_id,
        new_state: body.target_state ?? "approved",
      };
    },
  },
);
