/**
 * Keycloak Admin REST API client.
 *
 * Used by BFF routes for:
 * - User creation (registration)
 * - Credential management (password reset)
 * - Token exchange (login)
 * - User attribute management (participant_id, roles)
 * - Session management (logout, end-session)
 *
 * Authenticates to Keycloak via haiwave-portal-admin service account.
 */

import { loadEnv } from "@/config/env";
import { isAssignableRole } from "@/lib/auth";

const env = loadEnv();
const KEYCLOAK_URL = env.KEYCLOAK_URL;
const REALM = env.KEYCLOAK_REALM;
const ADMIN_CLIENT_ID = env.KEYCLOAK_ADMIN_CLIENT_ID;
const ADMIN_CLIENT_SECRET = env.KEYCLOAK_ADMIN_CLIENT_SECRET;
const PORTAL_CLIENT_ID = env.KEYCLOAK_PORTAL_CLIENT_ID;
const PORTAL_CLIENT_SECRET = env.KEYCLOAK_CLIENT_SECRET;

export const keycloakAdminUrl = `${KEYCLOAK_URL}/admin/realms/${REALM}`;
export const keycloakTokenUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;
const keycloakLogoutUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/logout`;

// ─── Admin Token Cache ──────────────────────────────────────

let adminToken: string | null = null;
let adminTokenExpiry = 0;

export async function getAdminToken(): Promise<string> {
  if (adminToken && Date.now() < adminTokenExpiry) return adminToken;

  const res = await fetch(keycloakTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: ADMIN_CLIENT_ID,
      client_secret: ADMIN_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Keycloak admin token failed: ${res.status}`);
  }

  const data = await res.json();
  adminToken = data.access_token;
  adminTokenExpiry = Date.now() + (data.expires_in - 30) * 1000;
  return adminToken!;
}

// ─── User Management ────────────────────────────────────────

interface CreateUserParams {
  email: string;
  firstName: string;
  lastName: string;
  attributes?: Record<string, string[]>;
}

// Create an invited user WITHOUT a credential and unverified. Identity assurance
// (IA-5) is completed by the invitee via `sendExecuteActionsEmail`
// (VERIFY_EMAIL + UPDATE_PASSWORD): the account cannot be used until they prove
// mailbox control and set a password only they know — the inviter never holds a
// working credential and email is not auto-trusted.
export async function createUser(params: CreateUserParams): Promise<string> {
  const token = await getAdminToken();

  const res = await fetch(`${keycloakAdminUrl}/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: params.email,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      enabled: true,
      emailVerified: false,
      attributes: params.attributes ?? {},
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Keycloak create user failed: ${res.status} ${body}`);
  }

  // Extract user ID from Location header
  const location = res.headers.get("Location") ?? "";
  const userId = location.split("/").pop() ?? "";
  return userId;
}

/**
 * Trigger Keycloak's execute-actions email so the user completes required
 * actions (e.g. VERIFY_EMAIL, UPDATE_PASSWORD) via a one-time link. Requires the
 * realm SMTP relay to be configured (D-41).
 */
export async function sendExecuteActionsEmail(
  userId: string,
  actions: string[],
  opts?: { clientId?: string; redirectUri?: string },
): Promise<void> {
  const token = await getAdminToken();

  const query = new URLSearchParams();
  if (opts?.clientId) query.set("client_id", opts.clientId);
  if (opts?.redirectUri) query.set("redirect_uri", opts.redirectUri);
  const qs = query.toString();

  const res = await fetch(
    `${keycloakAdminUrl}/users/${encodeURIComponent(userId)}/execute-actions-email${qs ? `?${qs}` : ""}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(actions),
    },
  );

  if (!res.ok) {
    throw new Error(`Keycloak execute-actions-email failed: ${res.status} ${await res.text()}`);
  }
}

// ─── Token Exchange (Login) ─────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function refreshToken(
  token: string,
): Promise<TokenResponse> {
  const res = await fetch(keycloakTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: PORTAL_CLIENT_ID,
      client_secret: PORTAL_CLIENT_SECRET,
      refresh_token: token,
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status}`);
  }

  return res.json();
}

// ─── Session Management ─────────────────────────────────────

export async function endSession(token: string): Promise<void> {
  await fetch(keycloakLogoutUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: PORTAL_CLIENT_ID,
      client_secret: PORTAL_CLIENT_SECRET,
      refresh_token: token,
    }),
  });
}

// ─── Admin User Operations ──────────────────────────────────

export interface KeycloakUser {
  id: string;
  attributes?: Record<string, string[]>;
}

/**
 * The participant's users, each carrying the realm role names mapped to them
 * (D-212: the realm role is the governing record; the `role` attribute is not
 * read). One role-mappings call per user, bounded by the `max=100` page.
 */
export async function listUsers(
  participantId: string,
): Promise<Array<KeycloakUser & { realmRoles: string[] }>> {
  const token = await getAdminToken();

  const res = await fetch(
    `${keycloakAdminUrl}/users?q=participant_id:${participantId}&max=100`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  // A refused or failed read is an outage the route reports (502), never an
  // empty roster shown as fact (SEC-web-core-1-04).
  if (!res.ok) {
    throw new Error(`Keycloak list users failed: ${res.status} ${await res.text()}`);
  }
  const users = (await res.json()) as KeycloakUser[];
  return Promise.all(
    users.map(async (user) => ({
      ...user,
      realmRoles: (await getUserRealmRoles(user.id)).map((r) => r.name),
    })),
  );
}

export async function getUser(userId: string): Promise<KeycloakUser> {
  const token = await getAdminToken();

  const res = await fetch(`${keycloakAdminUrl}/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Keycloak get user failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface RealmRole {
  id: string;
  name: string;
}

/** The realm roles currently mapped to the user — the governing record (D-212). */
export async function getUserRealmRoles(userId: string): Promise<RealmRole[]> {
  const token = await getAdminToken();
  const res = await fetch(
    `${keycloakAdminUrl}/users/${encodeURIComponent(userId)}/role-mappings/realm`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(`Keycloak role-mappings lookup failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Make `roleName` the user's one assignable realm role (D-212): every other
 * ASSIGNABLE realm role is removed first, then the new one is added. Roles
 * outside the assignable set (the realm default composite, account_owner,
 * haiwave_admin) are never touched. Remove-first means a failure between the
 * two steps leaves the user with less privilege, never more. Throws on any
 * Keycloak refusal. Returns the realm role names that govern afterwards, so
 * the caller reports the role that actually applies (a non-assignable role
 * such as account_owner is untouched and still wins).
 */
export async function updateUserRole(
  userId: string,
  roleName: string,
): Promise<string[]> {
  const token = await getAdminToken();
  const mappingsUrl = `${keycloakAdminUrl}/users/${encodeURIComponent(userId)}/role-mappings/realm`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const current = await getUserRealmRoles(userId);
  const stale = current.filter((r) => r.name !== roleName && isAssignableRole(r.name));
  if (stale.length > 0) {
    const del = await fetch(mappingsUrl, {
      method: "DELETE",
      headers,
      body: JSON.stringify(stale),
    });
    if (!del.ok) {
      throw new Error(`Keycloak role removal failed: ${del.status} ${await del.text()}`);
    }
  }

  const rolesRes = await fetch(
    `${keycloakAdminUrl}/roles/${roleName}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!rolesRes.ok) {
    throw new Error(`Keycloak role lookup failed: ${rolesRes.status} ${await rolesRes.text()}`);
  }
  const role = await rolesRes.json();

  const res = await fetch(mappingsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify([role]),
  });
  if (!res.ok) {
    throw new Error(`Keycloak role assignment failed: ${res.status} ${await res.text()}`);
  }

  const kept = current.filter((r) => !stale.includes(r)).map((r) => r.name);
  return Array.from(new Set([...kept, roleName]));
}

export async function disableUser(userId: string): Promise<void> {
  const token = await getAdminToken();

  const res = await fetch(`${keycloakAdminUrl}/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: false }),
  });
  if (!res.ok) {
    throw new Error(`Keycloak disable user failed: ${res.status} ${await res.text()}`);
  }
}

export async function deleteUser(userId: string): Promise<void> {
  const token = await getAdminToken();

  const res = await fetch(`${keycloakAdminUrl}/users/${userId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Keycloak delete user failed: ${res.status} ${body}`);
  }
}
