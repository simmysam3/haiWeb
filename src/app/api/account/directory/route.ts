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
 * Searches the HAIWAVE participant directory via haiCore.
 * Falls back to filtered mock directory data.
 */
export const GET = withHaiCore(
  ({ client, request }) => {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    return client.searchParticipants(query, { limit: 50 });
  },
  {
    fallback: (request: NextRequest) =>
      filterMockDirectory(request.nextUrl.searchParams.get("q") ?? ""),
  },
);
