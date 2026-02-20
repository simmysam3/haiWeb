import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_DIRECTORY } from "@/lib/mock-data";

/**
 * GET /api/account/directory?q=searchterm
 *
 * Searches the HAIWAVE participant directory via haiCore.
 * Falls back to filtered mock directory data.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(filterMockDirectory(query));
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const results = await client.searchParticipants(query, { limit: 50 });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json(filterMockDirectory(query));
  }
}

function filterMockDirectory(query: string) {
  if (!query) return MOCK_DIRECTORY;
  const lower = query.toLowerCase();
  return MOCK_DIRECTORY.filter(
    (c) =>
      c.company_name.toLowerCase().includes(lower) ||
      c.industry.toLowerCase().includes(lower) ||
      c.location.toLowerCase().includes(lower),
  );
}
