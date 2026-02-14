import { NextResponse } from "next/server";

/**
 * POST /api/auth/login
 *
 * Authenticates user via Keycloak Admin REST API.
 * Issues OIDC tokens, stores in HTTP-only secure cookies.
 */
export async function POST() {
  // TODO: Validate credentials against Keycloak
  // TODO: Exchange for OIDC tokens
  // TODO: Set HTTP-only secure cookie with access/refresh tokens
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
