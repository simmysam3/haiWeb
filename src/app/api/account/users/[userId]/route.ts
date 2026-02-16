import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole } from "@/lib/auth";
import { updateUserRole, disableUser } from "@/lib/keycloak";

/**
 * PATCH /api/account/users/:userId
 *
 * Updates a user's role in Keycloak. Requires account_owner role.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const body = await request.json();
    const { role } = body;

    if (!role) {
      return NextResponse.json({ error: "role is required" }, { status: 400 });
    }

    await updateUserRole(userId, role);
    return NextResponse.json({ success: true, user_id: userId, role });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update user role" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/account/users/:userId
 *
 * Disables a user in Keycloak. Requires account_owner role.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRole(session.user.role, "account_owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  // Prevent owners from disabling themselves
  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot disable your own account" },
      { status: 400 },
    );
  }

  try {
    await disableUser(userId);
    return NextResponse.json({ success: true, user_id: userId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disable user" },
      { status: 500 },
    );
  }
}
