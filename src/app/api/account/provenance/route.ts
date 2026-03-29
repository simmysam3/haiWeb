import { NextResponse } from "next/server";
import { getSession, getToken } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";

/**
 * GET /api/account/provenance
 *
 * Returns origin manifests and certifications from haiCore.
 * Falls back to empty arrays on error.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ manifests: [], certifications: [] });
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const [manifests, certifications] = await Promise.all([
      client.getOriginManifests(),
      client.getCertifications(),
    ]);

    return NextResponse.json({ manifests, certifications });
  } catch {
    return NextResponse.json({ manifests: [], certifications: [] });
  }
}
