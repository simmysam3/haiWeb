import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";

/**
 * POST /api/account/orders/:orderId
 *
 * Handles sell-side order actions: process, complete
 */
export const POST = withHaiCore<{ orderId: string }>(
  async ({ client, request, params }) => {
    const body = (await request.json()) as { action: string };

    switch (body.action) {
      case "process":
        return client.processOrder(params.orderId);
      case "complete":
        return client.completeOrder(params.orderId);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 },
        );
    }
  },
  { role: "account_admin" },
);
