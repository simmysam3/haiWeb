import { NextRequest, NextResponse } from "next/server";
import { PROTOCOL_VERSION } from "@haiwave/protocol";
import { requireAdminToken } from "@/lib/with-hai-core";
import { loadEnv } from "@/config/env";

const API_URL = loadEnv().HAIWAVE_API_URL;

// Allowlist: the only admin action slugs the BFF is allowed to relay.
// Anything else is a path-injection attempt and must be rejected.
const ACTION_SLUGS = new Set([
  "suspend",
  "reactivate",
  "clear-ban",
  "override-tier",
  "override-score",
]);

export async function POST(request: NextRequest) {
  const gate = await requireAdminToken();
  if (gate instanceof NextResponse) return gate;
  const { token } = gate;

  const { action, ...rest } = (await request.json()) as { action?: unknown; [key: string]: unknown };
  if (typeof action !== "string" || !ACTION_SLUGS.has(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_URL}/api/v1/admin/actions/${action}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-HaiWave-Protocol-Version": PROTOCOL_VERSION,
      },
      body: JSON.stringify(rest),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `haiCore ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Failed to reach haiCore" }, { status: 502 });
  }
}
