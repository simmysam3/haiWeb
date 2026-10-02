import { NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { listUsers } from "@/lib/keycloak";
import { toAccountUser, type KeycloakUserRep } from "@/lib/account-user";

/**
 * GET /api/account/sourcing-map/seat-users
 *
 * The seat's active users as `{ user_id, name }`, for the Supply Risk owner
 * select. Read-only, reads Keycloak (not haiCore), serves no email, role or phone.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const users = (await listUsers(session.participant.id)) as KeycloakUserRep[];
    return NextResponse.json({
      users: users
        .map(toAccountUser)
        .filter((u) => u.status === "active")
        .map((u) => ({
          user_id: u.id,
          name: `${u.first_name} ${u.last_name}`.trim() || u.email || u.id,
        })),
    });
  } catch (err) {
    // Surface the outage; an empty list would read as "this seat has no users".
    console.error("[account/sourcing-map/seat-users GET] failed to list users", err);
    return NextResponse.json({ error: "Could not load users." }, { status: 502 });
  }
}
