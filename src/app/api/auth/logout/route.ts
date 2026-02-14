import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 *
 * Clears local session and calls Keycloak end-session endpoint.
 */
export async function POST() {
  // TODO: Clear session cookie
  // TODO: Call Keycloak end-session endpoint
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
