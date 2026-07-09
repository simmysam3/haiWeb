import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { listUsers, createUser, sendExecuteActionsEmail } from "@/lib/keycloak";
import { toAccountUser, type KeycloakUserRep } from "@/lib/account-user";
import { MOCK_USERS } from "@/lib/mock-data";

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
  } catch {
    return NextResponse.json(MOCK_USERS);
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

    const userId = await createUser({
      email,
      firstName: first_name,
      lastName: last_name,
      attributes: {
        participant_id: [session.participant.id],
        role: [role ?? "account_viewer"],
      },
    });

    // The invitee proves mailbox control and sets their own password via
    // Keycloak's email flow; the portal never issues a usable credential.
    await sendExecuteActionsEmail(userId, ["VERIFY_EMAIL", "UPDATE_PASSWORD"]);

    return NextResponse.json({ id: userId, email, first_name, last_name, role: role ?? "account_viewer" }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create user" },
      { status: 500 },
    );
  }
}
