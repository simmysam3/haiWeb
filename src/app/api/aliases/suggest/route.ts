import { NextRequest, NextResponse } from "next/server";
import { PROTOCOL_VERSION } from "@haiwave/protocol";
import { haiwaveApiUrl } from "@/lib/haiwave-api";

/**
 * POST /api/aliases/suggest
 *
 * Public (no session) so the pre-auth registration form can use it, mirroring
 * the public /api/auth/register flow. Proxies to haiCore's public
 * /participants/alias-suggestions, which asks the model for common alternate
 * company names (abbreviations, tickers, short forms). Degrades to an empty
 * list if haiCore is unreachable so the form stays usable.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.legal_name !== "string" || !body.legal_name.trim()) {
    return NextResponse.json({ error: "legal_name is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${haiwaveApiUrl}/participants/alias-suggestions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-HaiWave-Protocol-Version": PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        legal_name: body.legal_name,
        dba_name: body.dba_name || undefined,
        website_url: body.website_url || undefined,
        vendor_description: body.vendor_description || undefined,
      }),
    });
    if (!res.ok) return NextResponse.json({ suggestions: [], grounded: false });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ suggestions: [], grounded: false });
  }
}
