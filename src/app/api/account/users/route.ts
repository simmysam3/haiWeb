import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole, isAssignableRole } from "@/lib/auth";
import { listUsers, createUser, sendExecuteActionsEmail, updateUserRole } from "@/lib/keycloak";
import { toAccountUser, type KeycloakUserRep } from "@/lib/account-user";

/**
 * GET /api/account/users
 *
 * Lists users for the current participant from Keycloak.
 * Requires account_owner role. Falls back to mock users.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = await listUsers(session.participant.id);
    return NextResponse.json((users as KeycloakUserRep[]).map(toAccountUser));
  } catch (err) {
    // Surface the outage; never fabricate a user list from mock data.
    console.error("[account/users GET] failed to list users", err);
    return NextResponse.json(
      { error: "Could not load users. Please try again." },
      { status: 502 },
    );
  }
}

/**
 * POST /api/account/users
 *
 * Invites a new user to the participant account via Keycloak.
 * Requires account_owner role.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, first_name, last_name, role } = body;

    if (!email || !first_name || !last_name) {
      return NextResponse.json(
        { error: "email, first_name, and last_name are required" },
        { status: 400 },
      );
    }

    // Only a role an owner may grant (never account_owner or a platform role).
    if (typeof role !== "string" || !isAssignableRole(role)) {
      return NextResponse.json(
        { error: "role is not assignable" },
        { status: 400 },
      );
    }

    const userId = await createUser({
      email,
      firstName: first_name,
      lastName: last_name,
      attributes: {
        participant_id: [session.participant.id],
      },
    });

    // The realm role is the governing record (D-212): grant exactly the one
    // chosen, before the invitee can log in.
    await updateUserRole(userId, role);

    // The invitee proves mailbox control and sets their own password via
    // Keycloak's email flow; the portal never issues a usable credential.
    await sendExecuteActionsEmail(userId, ["VERIFY_EMAIL", "UPDATE_PASSWORD"]);

    return NextResponse.json({ id: userId, email, first_name, last_name, role }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 },
    );
  }
}
