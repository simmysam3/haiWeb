import { NextRequest, NextResponse } from "next/server";
import { PROTOCOL_VERSION } from "@haiwave/protocol";
import { requireAdminToken } from "@/lib/with-hai-core";
import { loadEnv } from "@/config/env";

const API_URL = loadEnv().HAIWAVE_API_URL;

// Allowlist: only these dashboard sub-paths are proxied.
const DASHBOARD_TYPES = new Set(["overview", "suspicious", "failed_submissions", "health"]);

export async function GET(request: NextRequest) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { token } = gate;

  const type = request.nextUrl.searchParams.get("type") ?? "overview";
  if (!DASHBOARD_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid dashboard type" }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/dashboard/${type}`, {
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
