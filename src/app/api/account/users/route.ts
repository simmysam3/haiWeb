import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole, isAssignableRole } from "@/lib/auth";
import { listUsers, createUser, sendExecuteActionsEmail, updateUserRole, getRealmRole, RealmRoleNotFoundError } from "@/lib/keycloak";
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
 * A plain sentence for the invite dialog. The failure detail goes to the server
 * log, never to the browser. "Nothing was created" is claimed only while it is
 * still true: everything before `createUser` is validation and a read.
 */
function inviteFailureMessage(
  err: unknown,
  createdUserId: string | null,
  roleAssigned: boolean,
): string {
  if (createdUserId === null) {
    return err instanceof RealmRoleNotFoundError
      ? `The role ${err.roleName} is not defined in the sign-in realm. Nothing was created.`
      : "The invitation could not be completed. Nothing was created.";
  }
  if (!roleAssigned) {
    return "The user was created but their role could not be set. An administrator must finish setting up the account.";
  }
  return "The user was created but the invitation email could not be sent.";
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

  // What actually happened before a failure, so the message can be honest about
  // it. Nothing before `createUser` mutates Keycloak.
  let createdUserId: string | null = null;
  let roleAssigned = false;

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

    // Resolve the realm role before creating anyone: a lookup that fails must
    // leave no half-provisioned account behind (W-F4).
    await getRealmRole(role);

    const userId = await createUser({
      email,
      firstName: first_name,
      lastName: last_name,
      attributes: {
        participant_id: [session.participant.id],
      },
    });
    createdUserId = userId;

    // The realm role is the governing record (D-212): grant exactly the one
    // chosen, before the invitee can log in.
    await updateUserRole(userId, role);
    roleAssigned = true;

    // The invitee proves mailbox control and sets their own password via
    // Keycloak's email flow; the portal never issues a usable credential.
    await sendExecuteActionsEmail(userId, ["VERIFY_EMAIL", "UPDATE_PASSWORD"]);

    return NextResponse.json({ id: userId, email, first_name, last_name, role }, { status: 201 });
  } catch (err) {
    // The detail is for the server log; the dialog gets a plain sentence.
    console.error("[account/users POST] invitation failed", err);
    return NextResponse.json(
      { error: inviteFailureMessage(err, createdUserId, roleAssigned) },
      { status: 500 },
    );
  }
}
