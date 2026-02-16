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

const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
const REALM = process.env.KEYCLOAK_REALM ?? "haiwave-network";
const ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? "haiwave-portal-admin";
const ADMIN_CLIENT_SECRET = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET ?? "";
const PORTAL_CLIENT_ID = process.env.KEYCLOAK_PORTAL_CLIENT_ID ?? "haiwave-portal";

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
  password: string;
  attributes?: Record<string, string[]>;
}

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
      emailVerified: true,
      credentials: [
        { type: "password", value: params.password, temporary: false },
      ],
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

// ─── Token Exchange (Login) ─────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const res = await fetch(keycloakTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: PORTAL_CLIENT_ID,
      username: email,
      password: password,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Authentication failed: ${res.status} ${body}`);
  }

  return res.json();
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
      refresh_token: token,
    }),
  });
}

// ─── Admin User Operations ──────────────────────────────────

export async function listUsers(participantId: string): Promise<unknown[]> {
  const token = await getAdminToken();

  const res = await fetch(
    `${keycloakAdminUrl}/users?q=participant_id:${participantId}&max=100`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!res.ok) return [];
  return res.json();
}

export async function updateUserRole(
  userId: string,
  roleName: string,
): Promise<void> {
  const token = await getAdminToken();

  // Get role by name
  const rolesRes = await fetch(
    `${keycloakAdminUrl}/roles/${roleName}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!rolesRes.ok) return;
  const role = await rolesRes.json();

  // Assign role
  await fetch(
    `${keycloakAdminUrl}/users/${userId}/role-mappings/realm`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([role]),
    },
  );
}

export async function disableUser(userId: string): Promise<void> {
  const token = await getAdminToken();

  await fetch(`${keycloakAdminUrl}/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: false }),
  });
}
