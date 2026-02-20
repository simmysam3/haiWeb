import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import {
  MOCK_INBOUND_REQUIREMENTS,
  MOCK_OUTBOUND_POSTURES,
  MOCK_PRICING_DEFAULTS,
} from "@/lib/mock-data";

/**
 * GET /api/account/manifests
 *
 * Returns counterparty and pricing manifest data from haiCore.
 * Falls back to mock manifests.
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
        inbound_requirements: MOCK_INBOUND_REQUIREMENTS,
        outbound_postures: MOCK_OUTBOUND_POSTURES,
        pricing_defaults: MOCK_PRICING_DEFAULTS,
      });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const manifest = await client.getCounterpartyManifest(session.participant.id);
    return NextResponse.json(manifest);
  } catch {
    return NextResponse.json({
      inbound_requirements: MOCK_INBOUND_REQUIREMENTS,
      outbound_postures: MOCK_OUTBOUND_POSTURES,
      pricing_defaults: MOCK_PRICING_DEFAULTS,
    });
  }
}

/**
 * PUT /api/account/manifests
 *
 * Updates counterparty or pricing manifest via haiCore.
 * Body: { type: "counterparty" | "pricing", data: {...} }
 * Requires account_admin or higher.
 */
export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { type, data } = body;

    if (type !== "counterparty" && type !== "pricing") {
      return NextResponse.json(
        { error: "type must be 'counterparty' or 'pricing'" },
        { status: 400 },
      );
    }

    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, type, ...data });
    }

    const client = createHaiwaveClient(token, session.participant.id);

    if (type === "counterparty") {
      const result = await client.updateCounterpartyManifest(data);
      return NextResponse.json(result);
    } else {
      const result = await client.updatePricingManifest(data);
      return NextResponse.json(result);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update manifest" },
      { status: 500 },
    );
  }
}
