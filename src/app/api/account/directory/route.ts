import { NextRequest } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_DIRECTORY } from "@/lib/mock-data";
import type { MockDirectoryCompany } from "@/lib/mock-types";

function filterMockDirectory(query: string): MockDirectoryCompany[] {
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
 * haiCore /participants/search returns a {query, results, total_results}
 * envelope where each result is a rich {participant, behavioral_score,
 * relationship_state, ...} record. The UI consumes a flat MockDirectoryCompany
 * shape, so we map at the BFF.
 */
interface HaiCoreParticipant {
  id: string;
  legal_name?: string;
  dba_name?: string | null;
  business_type?: string | null;
  vendor_description?: string | null;
  business_address_city?: string | null;
  business_address_state?: string | null;
  categories?: string[];
}

interface HaiCoreSearchResult {
  participant: HaiCoreParticipant;
  relationship_state?: "none" | "approved" | "trading_pair" | "banned" | "pending";
  product_lines?: string[];
}

interface HaiCoreSearchEnvelope {
  query?: string;
  results?: HaiCoreSearchResult[];
  total_results?: number;
}

function locationOf(p: HaiCoreParticipant): string {
  const city = p.business_address_city?.trim();
  const state = p.business_address_state?.trim();
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? "";
}

function industryOf(p: HaiCoreParticipant): string {
  if (p.categories && p.categories.length > 0) return p.categories[0];
  return p.business_type ?? "";
}

function mapHaiCoreResult(r: HaiCoreSearchResult): MockDirectoryCompany {
  const p = r.participant;
  return {
    id: p.id,
    company_name: p.dba_name ?? p.legal_name ?? "Unknown",
    location: locationOf(p),
    industry: industryOf(p),
    description: p.vendor_description ?? "",
    connection_status: r.relationship_state ?? "none",
  };
}

/**
 * GET /api/account/directory?q=searchterm
 *
 * Searches the HAIWAVE participant directory via haiCore, excluding the
 * caller's own participant_id. haiCore requires q ≥ 2 characters; below
 * that we short-circuit with [] so the modal can prompt the user to type
 * more rather than firing 400s.
 *
 * Falls back to mock directory data when haiCore is unreachable.
 */
export const GET = withHaiCore(
  async ({ client, session, request }) => {
    const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (query.length < 2) return [];

    const envelope = (await client.searchParticipants(query, { limit: 50 })) as unknown as
      | HaiCoreSearchEnvelope
      | HaiCoreSearchResult[];

    const rawResults = Array.isArray(envelope) ? envelope : envelope.results ?? [];
    return rawResults
      .filter((r) => r.participant.id !== session.participant.id)
      .map(mapHaiCoreResult);
  },
  {
    fallback: (request: NextRequest) =>
      filterMockDirectory(request.nextUrl.searchParams.get("q") ?? ""),
  },
);
