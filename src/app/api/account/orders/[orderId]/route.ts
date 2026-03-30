import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * POST /api/account/orders/:orderId
 *
 * Handles sell-side order actions: process, complete
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getToken();
  if (!token || !token.includes(".")) {
    return NextResponse.json({ error: "Not authenticated with haiCore" }, { status: 401 });
  }

  const { orderId } = await params;
  const body = (await request.json()) as { action: string };
  const client = createHaiwaveClient(token, session.participant.id);

  try {
    switch (body.action) {
      case "process": {
        const result = await client.processOrder(orderId);
        return NextResponse.json(result);
      }
      case "complete": {
        const result = await client.completeOrder(orderId);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
