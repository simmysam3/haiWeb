import { NextResponse } from "next/server";

/**
 * POST /api/auth/register
 *
 * Creates Keycloak user via Admin REST API.
 * Sends email verification link.
 * Step 1 of 3-step registration flow.
 */
export async function POST() {
  // TODO: Validate registration fields
  // TODO: Create user in Keycloak via Admin REST API
  // TODO: Send email verification
  // TODO: Return success with next step instructions
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
