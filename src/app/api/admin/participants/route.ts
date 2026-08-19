import { NextResponse } from "next/server";
import { PROTOCOL_VERSION } from "@haiwave/protocol";
import { requireAdminToken } from "@/lib/with-hai-core";
import { loadEnv } from "@/config/env";

const API_URL = loadEnv().HAIWAVE_API_URL;

// v1.75 walk W7: the real list behind the participants page — a straight
// proxy of haiCore GET /api/v1/admin/participants. Errors pass through as
// errors; this route never fabricates data (F-4 lesson).
export async function GET() {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { token } = gate;

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/participants`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-HaiWave-Protocol-Version": PROTOCOL_VERSION,
      },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Failed to reach haiCore" }, { status: 502 });
  }
}
