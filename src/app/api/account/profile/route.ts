import { NextResponse } from "next/server";
import { withHaiCore } from "@/lib/with-hai-core";
import { MOCK_SESSION } from "@/lib/mock-data";

/**
 * GET /api/account/profile
 *
 * Returns company profile from haiCore. Falls back to mock session participant.
 */
export const GET = withHaiCore(
  ({ client, session }) => client.getCompanyProfile(session.participant.id),
  { fallback: MOCK_SESSION.participant },
);

/**
 * PUT /api/account/profile
 *
 * Updates company profile via haiCore. Requires account_admin or higher. No
 * fallback: a non-JWT token (dev shim, or a poisoned/misconfigured cookie in
 * prod) must 401 rather than echo the request body back as a fake success.
 * Uses `client.fetchRaw` (raw passthrough) instead of a typed method because
 * the client does not currently expose this v1 endpoint.
 */
export const PUT = withHaiCore(
  async ({ client, session, request }) => {
    const body = await request.json();
    const res = await client.fetchRaw(
      `/company/${encodeURIComponent(session.participant.id)}/profile`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  },
  { role: "account_admin" },
);
