import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import {
  MOCK_INBOUND_REQUIREMENTS,
  MOCK_OUTBOUND_POSTURES,
  MOCK_PRICING_DEFAULTS,
} from "@/lib/mock-data";

const MOCK_MANIFEST_BUNDLE = {
  inbound_requirements: MOCK_INBOUND_REQUIREMENTS,
  outbound_postures: MOCK_OUTBOUND_POSTURES,
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
 */
export const PUT = withHaiCore(
  async ({ client, request }) => {
    const body = await request.json();
    const { type, data } = body;

    if (type !== "counterparty" && type !== "pricing") {
      return NextResponse.json(
        { error: "type must be 'counterparty' or 'pricing'" },
        { status: 400 },
      );
    }

    if (type === "counterparty") {
      return client.updateCounterpartyManifest(data);
    }
    return client.updatePricingManifest(data);
  },
  {
    role: "account_admin",
  },
);
