import { NextRequest, NextResponse } from "next/server";
import { PROTOCOL_VERSION } from "@haiwave/protocol";
import { getSession, getToken } from "@/lib/auth";
import { isJwtLike } from "@/lib/with-hai-core";
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const token = await getToken();
  if (!isJwtLike(token)) return NextResponse.json({ error: "No token" }, { status: 401 });

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
