import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PROTOCOL_VERSION } from "@haiwave/protocol";
import { getSession } from "@/lib/auth";
import { haiwaveApiUrl } from "@/lib/haiwave-api";

// legal_name is required; the other three mirror the optional fields the
// profile form may omit. All capped at 500 chars — this proxies straight
// into a per-request model call upstream, so an oversized body would inflate
// an authenticated request into an outsized model call.
const SuggestSchema = z.object({
  legal_name: z.string().trim().min(1).max(500),
  dba_name: z.string().max(500).optional(),
  website_url: z.string().max(500).optional(),
  vendor_description: z.string().max(500).optional(),
});

/**
 * POST /api/aliases/suggest
 *
 * Requires an authenticated session. The pre-auth registration flow that
 * once justified public access was retired in v1.47 (src/app/register/page.tsx
 * is now a static activation landing) — the only live caller is the
 * authenticated profile form (src/components/alias-editor.tsx). Proxies to
 * haiCore's /participants/alias-suggestions, which asks the model for common
 * alternate company names (abbreviations, tickers, short forms). Degrades to
 * an empty list if haiCore is unreachable so the form stays usable.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.json().catch(() => null);
  const parsed = SuggestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

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
