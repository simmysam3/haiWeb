import { NextRequest, NextResponse } from "next/server";
import { getSession, hasRole, isAssignableRole, resolveUserRole } from "@/lib/auth";
import {
  updateUserRole,
  updateUserName,
  disableUser,
  deleteUser,
  getUser,
  getUserRealmRoles,
  getRealmRole,
  RealmRoleNotFoundError,
  type KeycloakUser,
} from "@/lib/keycloak";

// The target user when it belongs to the caller's participant, else null. A
// missing or foreign target is reported as 404 by the callers so the endpoint
// does not disclose the existence of users in other tenants.
async function sameTenantTarget(
  userId: string,
  participantId: string,
): Promise<KeycloakUser | null> {
  try {
    const target = await getUser(userId);
    return target.attributes?.participant_id?.[0] === participantId ? target : null;
  } catch {
    return null;
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * A plain sentence for the Edit dialog. "Nothing was changed" is claimed only
 * while it is true: the role is resolved before any write, and the name PUT is
 * a single request, so every failure before the role change starts left the
 * user exactly as it was. Once the role change has started, remove-first
 * (D-212) means the old role may already be gone.
 */
function patchFailureMessage(err: unknown, nameSaved: boolean, roleStarted: boolean): string {
  // updateUserRole resolves the role again before it mutates, so a not-found
  // from there is still "nothing changed" for the role — but not for a name
  // saved a moment earlier (Task 2 review ruling).
  if (err instanceof RealmRoleNotFoundError && !nameSaved) {
    return `The role ${err.roleName} is not defined in the sign-in realm. Nothing was changed.`;
  }
  if (!roleStarted) {
    return "The user could not be updated. Nothing was changed.";
  }
  return nameSaved
    ? "The name was saved, but the role change did not complete. Check the user's current role before trying again."
    : "The role change did not complete. Check the user's current role before trying again.";
}

/**
 * PATCH /api/account/users/:userId
 *
 * Changes a user's name, role, or status (deactivation) in Keycloak. Requires
 * account_owner role. The email is never editable: a wrong email is a delete
 * and a fresh invitation (owner ruling 2026-09-06).
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
  const { first_name, last_name, role, status } = await readJson(request);
  const wantsName = first_name !== undefined || last_name !== undefined;
  const wantsRole = role !== undefined;
  const wantsStatus = status !== undefined;

  if (!wantsName && !wantsRole && !wantsStatus) {
    return NextResponse.json({ error: "No changes were requested." }, { status: 400 });
  }

  // Deactivation travels alone so its single PUT keeps "Nothing was changed"
  // literally true (#184).
  if (wantsStatus) {
    if (status !== "disabled" || wantsName || wantsRole) {
      return NextResponse.json(
        { error: "status can only be set to disabled, on its own." },
        { status: 400 },
      );
    }
    if (userId === session.user.id) {
      return NextResponse.json({ error: "You can't deactivate your own account." }, { status: 400 });
    }
    if (!(await sameTenantTarget(userId, session.participant.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    try {
      await disableUser(userId);
      return NextResponse.json({ success: true, user_id: userId, status: "disabled" });
    } catch (err) {
      // The detail is for the server log; the dialog gets a plain sentence.
      console.error("[account/users PATCH] failed to deactivate user", err);
      return NextResponse.json(
        { error: "The user could not be deactivated. Nothing was changed." },
        { status: 500 },
      );
    }
  }

  if (wantsName && !(isNonEmptyString(first_name) && isNonEmptyString(last_name))) {
    return NextResponse.json(
      { error: "first_name and last_name are required together" },
      { status: 400 },
    );
  }
  if (wantsRole && (typeof role !== "string" || !isAssignableRole(role))) {
    return NextResponse.json({ error: "role is not assignable" }, { status: 400 });
  }

  let nameSaved = false;
  let roleStarted = false;
  try {
    // Resolve the role before touching anything (W-F4): a missing role must
    // leave the user exactly as it was — name included.
    if (wantsRole) {
      await getRealmRole(role as string);
    }

    if (!(await sameTenantTarget(userId, session.participant.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result: Record<string, unknown> = { success: true, user_id: userId };
    if (wantsName) {
      await updateUserName(userId, (first_name as string).trim(), (last_name as string).trim());
      nameSaved = true;
      result.first_name = (first_name as string).trim();
      result.last_name = (last_name as string).trim();
    }
    if (wantsRole) {
      roleStarted = true;
      // The realm role-mappings govern (D-212): report the role that applies
      // after the change, which may differ from the one requested when the
      // target holds a role this route never removes (account_owner).
      const governing = await updateUserRole(userId, role as string);
      result.role = resolveUserRole(governing);
    }
    return NextResponse.json(result);
  } catch (err) {
    // The detail is for the server log; the dialog gets a plain sentence.
    console.error("[account/users PATCH] failed to update user", err);
    return NextResponse.json(
      { error: patchFailureMessage(err, nameSaved, roleStarted) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/account/users/:userId
 *
 * Permanently deletes a user in Keycloak. Requires account_owner role. The
 * body must name the user (`{ email }`): a browser tab still running an older
 * bundle sends a body-less DELETE that used to mean "deactivate", and that
 * request must fail closed here, never delete. Records of what the user did
 * are kept — haiCore stores actors as plain ids with no link to Keycloak.
 */
export async function DELETE(
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

  if (userId === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const target = await sameTenantTarget(userId, session.participant.id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // An owner is never deleted from the console: the delete is irreversible and
  // the portal cannot re-create an owner (ASSIGNABLE_USER_ROLES excludes it), so
  // a peer owner — or a platform user whose participant matches — is protected
  // here, not only by the hidden row actions (final-review ruling).
  let roles: string[];
  try {
    roles = (await getUserRealmRoles(userId)).map((r) => r.name);
  } catch (err) {
    // Nothing has been mutated yet, so the plain sentence is literally true.
    console.error("[account/users DELETE] failed to read the target's roles", err);
    return NextResponse.json(
      { error: "The user could not be deleted. Nothing was changed." },
      { status: 500 },
    );
  }
  if (resolveUserRole(roles) === "account_owner") {
    return NextResponse.json(
      { error: "Account owners can't be deleted from the console." },
      { status: 400 },
    );
  }

  const { email } = await readJson(request);
  const named =
    isNonEmptyString(email) &&
    isNonEmptyString(target.email) &&
    email.trim().toLowerCase() === target.email.trim().toLowerCase();
  if (!named) {
    return NextResponse.json(
      { error: "The request did not name the user to delete. Nothing was changed." },
      { status: 400 },
    );
  }

  try {
    await deleteUser(userId);
    // `deleted: true` says the user is gone, not merely disabled. The client
    // requires it before it removes the row, so a request answered by an older
    // instance mid-deploy cannot read as a permanent delete.
    return NextResponse.json({ success: true, user_id: userId, deleted: true });
  } catch (err) {
    // The detail is for the server log; the dialog gets a plain sentence.
    // `deleteUser` is one DELETE and it is the only call in this try, so a
    // failure leaves the user exactly as it was.
    console.error("[account/users DELETE] failed to delete user", err);
    return NextResponse.json(
      { error: "The user could not be deleted. Nothing was changed." },
      { status: 500 },
    );
  }
}
