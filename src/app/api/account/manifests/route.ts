import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_PRICING_DEFAULTS } from "@/lib/mock-data";

const MOCK_MANIFEST_BUNDLE = {
  pricing_defaults: MOCK_PRICING_DEFAULTS,
};

/**
 * GET /api/account/manifests
 *
 * Returns counterparty and pricing manifest data from haiCore.
 * Falls back to mock manifests.
 */
export const GET = withHaiCore(
  ({ client, session }) => client.getCounterpartyManifest(session.participant.id),
  { fallback: MOCK_MANIFEST_BUNDLE },
);

/**
 * PUT /api/account/manifests
 *
 * Updates counterparty or pricing manifest via haiCore.
 * Body: { type: "counterparty" | "pricing", data: {...} }
 * Requires account_admin or higher.
 *
 * For the counterparty type the client only sends the lead-time posture
 * ({ lead_time_trend_sharing }). haiCore's CounterpartyManifestSchema requires
 * the full manifest (manifest_id, participant_id, manifest_type, version,
 * effective_date, baseline_requirements), and the posture lives inside
 * baseline_requirements — so the BFF reads the current manifest, merges the
 * posture in, and writes the whole object back.
 */
export const PUT = withHaiCore(
  async ({ client, session, request }) => {
    const body = await request.json();
    const { type, data } = body;

    if (type !== "counterparty" && type !== "pricing") {
      return NextResponse.json(
        { error: "type must be 'counterparty' or 'pricing'" },
        { status: 400 },
      );
    }

    if (type === "counterparty") {
      const current = await client.getCounterpartyManifest(session.participant.id);
      if (!current) {
        return NextResponse.json(
          { error: "No counterparty manifest on file yet" },
          { status: 409 },
        );
      }
      const baseline = (current.baseline_requirements ?? {}) as Record<string, unknown>;
      const merged = {
        ...current,
        baseline_requirements: {
          ...baseline,
          lead_time_trend_sharing: data.lead_time_trend_sharing,
        },
      };
      return client.updateCounterpartyManifest(merged);
    }
    return client.updatePricingManifest(data);
  },
  {
    role: "account_admin",
  },
);
