import { NextRequest } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_DIRECTORY } from "@/lib/mock-data";

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

/**
 * GET /api/account/directory?q=searchterm
 *
 * Searches the HAIWAVE participant directory via haiCore, excluding the
 * caller's own participant_id (you aren't your own trading partner).
 * Falls back to mock directory data — the client is expected to filter self
 * from the fallback result since session context isn't available here.
 */
export const GET = withHaiCore(
  async ({ client, session, request }) => {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const results = await client.searchParticipants(query, { limit: 50 });
    return Array.isArray(results)
      ? results.filter((r) => (r as { id?: string }).id !== session.participant.id)
      : results;
  },
  {
    fallback: (request: NextRequest) =>
      filterMockDirectory(request.nextUrl.searchParams.get("q") ?? ""),
  },
);
