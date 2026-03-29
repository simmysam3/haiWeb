import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * GET /api/account/phantom-demand
 *
 * Returns phantom demand usage and forecast from haiCore.
 * Falls back to empty data on error.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({
        usage: { entries: [], total_requests: 0 },
        forecast: { entries: [] },
      });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const [usage, forecast] = await Promise.all([
      client.getPhantomDemandUsage(),
      client.getPhantomDemandForecast(),
    ]);

    return NextResponse.json({ usage, forecast });
  } catch {
    return NextResponse.json({
      usage: { entries: [], total_requests: 0 },
      forecast: { entries: [] },
    });
  }
}
