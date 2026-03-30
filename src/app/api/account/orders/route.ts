import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * GET /api/account/orders
 *
 * Returns sell-side orders from haiCore. Falls back to empty list.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ sell_side: [] });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const orders = await client.getSellSideOrders();
    return NextResponse.json({ sell_side: orders });
  } catch {
    return NextResponse.json({ sell_side: [] });
  }
}
