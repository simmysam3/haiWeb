import { NextResponse } from "next/server";

/**
 * POST /api/auth/refresh
 *
 * Refreshes OIDC tokens via Keycloak token endpoint.
 * Called by Next.js middleware before token expiry.
 */
export async function POST() {
  // TODO: Read refresh token from cookie
  // TODO: Exchange for new access/refresh tokens via Keycloak
  // TODO: Update cookie
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
