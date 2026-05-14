import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_ACCESS_REQUESTS } from "@/lib/mock-data";

/**
 * GET /api/account/connections
 *
 * Lists pending connection requests from haiCore. Falls back to mock data.
 */
interface HaiCorePendingRow {
  id: string;
  requesting_participant_id?: string;
  requesting_name?: string;
  requested_level?: "approved" | "trading_pair";
  invite?: boolean;
  context_message?: string | null;
  requested_at?: string;
}

interface HaiCoreLocality {
  city?: string;
  state?: string;
  country?: string;
}

interface HaiCoreCategory {
  class_id: string;
  class_name?: string;
  product_count?: number;
}

interface HaiCorePublicProfile {
  participant_id: string;
  legal_name?: string;
  dba_name?: string;
  vendor_description?: string;
  business_type?: string;
  locality?: HaiCoreLocality;
  primary_contact_name?: string;
  registered_at?: string;
  categories?: HaiCoreCategory[];
}

function ageDays(requestedAt: string): number {
  const ms = Date.now() - new Date(requestedAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function locationFrom(loc: HaiCoreLocality | undefined): string {
  if (!loc) return "";
  const city = loc.city?.trim();
  const state = loc.state?.trim();
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? "";
}

// Quick US Census-region heuristic. Empty string when state isn't recognized
// (international participants, missing state) so the queue card subtitle doesn't
// show a placeholder string.
const STATE_TO_REGION: Record<string, string> = {
  CT: "Northeast", ME: "Northeast", MA: "Northeast", NH: "Northeast", RI: "Northeast", VT: "Northeast",
  NJ: "Northeast", NY: "Northeast", PA: "Northeast",
  IL: "Midwest", IN: "Midwest", MI: "Midwest", OH: "Midwest", WI: "Midwest",
  IA: "Midwest", KS: "Midwest", MN: "Midwest", MO: "Midwest", NE: "Midwest", ND: "Midwest", SD: "Midwest",
  DE: "South", FL: "South", GA: "South", MD: "South", NC: "South", SC: "South", VA: "South", WV: "South", DC: "South",
  AL: "South", KY: "South", MS: "South", TN: "South",
  AR: "South", LA: "South", OK: "South", TX: "South",
  AZ: "West", CO: "West", ID: "West", MT: "West", NV: "West", NM: "West", UT: "West", WY: "West",
  AK: "West", CA: "West", HI: "West", OR: "West", WA: "West",
};

function regionFrom(loc: HaiCoreLocality | undefined): string {
  const state = loc?.state?.trim().toUpperCase();
  if (!state) return "";
  return STATE_TO_REGION[state] ?? "";
}

function industryFrom(profile: HaiCorePublicProfile | undefined): string {
  const top = profile?.categories?.[0];
  if (top?.class_name) return top.class_name;
  return profile?.business_type ?? "";
}

function productLinesFrom(profile: HaiCorePublicProfile | undefined): string[] {
  return (profile?.categories ?? [])
    .map((c) => c.class_name)
    .filter((name): name is string => !!name)
    .slice(0, 6);
}

/**
 * GET /api/account/connections
 *
 * Lists pending connection requests from haiCore and enriches each row with
 * the requester's public company profile (parallel fan-out via
 * /company/:id/profile). Profile fetches use Promise.allSettled so a single
 * 404 or 500 doesn't drop the whole queue — that requester just renders
 * with empty subtitle/description fields.
 *
 * behavioral_score is not enriched here (would require a third per-row fetch
 * to /participants/:id/credibility); it stays null and the card shows the
 * "New to Network" treatment.
 *
 * Falls back to mock data when haiCore is unreachable.
 */
export const GET = withHaiCore(
  async ({ client }) => {
    const rows = (await client.listPendingRequests()) as unknown as HaiCorePendingRow[];
    if (rows.length === 0) return [];

    const profileResults = await Promise.allSettled(
      rows.map((r) =>
        r.requesting_participant_id
          ? (client.getCompanyProfile(r.requesting_participant_id) as unknown as Promise<HaiCorePublicProfile>)
          : Promise.reject(new Error("missing requesting_participant_id")),
      ),
    );

    return rows.map((r, i) => {
      const requestedAt = r.requested_at ?? new Date().toISOString();
      const settled = profileResults[i];
      const profile: HaiCorePublicProfile | undefined =
        settled.status === "fulfilled" ? settled.value : undefined;

      return {
        id: r.id,
        company_name: r.requesting_name ?? profile?.dba_name ?? profile?.legal_name ?? "Unknown participant",
        contact_name: profile?.primary_contact_name ?? "",
        message: r.context_message ?? "",
        requested_at: requestedAt,
        industry: industryFrom(profile),
        location: locationFrom(profile?.locality),
        business_type: profile?.business_type ?? "",
        company_description: profile?.vendor_description ?? "",
        behavioral_score: null,
        product_lines: productLinesFrom(profile),
        region: regionFrom(profile?.locality),
        network_member_since: profile?.registered_at ?? null,
        request_type: r.requested_level ?? "approved",
        invite: r.invite ?? false,
        age_days: ageDays(requestedAt),
      };
    });
  },
  { fallback: MOCK_ACCESS_REQUESTS },
);

/**
 * POST /api/account/connections
 *
 * Requests a new connection via haiCore. Requires account_admin or higher.
 * Returns 201 on success, so kept outside withHaiCore to preserve semantics.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { target_participant_id, message } = body;

    if (!target_participant_id) {
      return NextResponse.json(
        { error: "target_participant_id is required" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(
        { success: true, target_participant_id, status: "pending" },
        { status: 201 },
      );
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const result = await client.requestConnection(target_participant_id, { message });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to request connection" },
      { status: 500 },
    );
  }
}
