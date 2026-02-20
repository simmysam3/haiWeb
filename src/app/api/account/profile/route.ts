import { NextRequest, NextResponse } from "next/server";
import { getSession, getToken, hasRole } from "@/lib/auth";
import { createHaiwaveClient } from "@/lib/haiwave-api";
import { MOCK_SESSION } from "@/lib/mock-data";

/**
 * GET /api/account/profile
 *
 * Returns company profile from haiCore. Falls back to mock session participant.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json(MOCK_SESSION.participant);
    }

    const client = createHaiwaveClient(token, session.participant.id);
    const profile = await client.getCompanyProfile(session.participant.id);
    return NextResponse.json(profile);
  } catch {
    return NextResponse.json(MOCK_SESSION.participant);
  }
}

/**
 * PUT /api/account/profile
 *
 * Updates company profile via haiCore. Requires account_admin or higher.
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
    const token = await getToken();
    if (!token || !token.includes(".")) {
      return NextResponse.json({ success: true, ...body });
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "x-participant-id": session.participant.id,
      "X-HaiWave-Protocol-Version": "1.0.0",
      "Content-Type": "application/json",
    };

    const res = await fetch(
      `${process.env.HAIWAVE_API_URL ?? "http://localhost:3000"}/api/v1/company/${session.participant.id}/profile`,
      { method: "PUT", headers, body: JSON.stringify(body) },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile" },
      { status: 500 },
    );
  }
}
