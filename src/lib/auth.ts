import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { MOCK_SESSION } from "./mock-data";

// JWKS for Keycloak realm. `createRemoteJWKSet` memoizes the remote key set
// internally, so this only fetches keys on cold start and on key rotation.
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM ?? "haiwave-network";
const KEYCLOAK_JWKS_URI =
  process.env.KEYCLOAK_JWKS_URI ??
  `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(KEYCLOAK_JWKS_URI));

// The portal client the session cookie must belong to. A valid signature +
// issuer is not enough: any client in the same realm (e.g. an agent
// service-account token minted via client_credentials) would otherwise satisfy
// them and be accepted as a user session.
const PORTAL_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? "haiwave-portal";

function tokenIssuedToPortal(payload: JWTPayload): boolean {
  // `azp` (authorized party) is the client that requested the token — the most
  // reliable discriminator. Fall back to `aud` for realms that stamp it there.
  if (payload.azp === PORTAL_CLIENT_ID) return true;
  const aud = payload.aud;
  if (typeof aud === "string") return aud === PORTAL_CLIENT_ID;
  if (Array.isArray(aud)) return aud.includes(PORTAL_CLIENT_ID);
  return false;
}

async function verifySessionJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      // Reject `alg: none` and similar tampering
      algorithms: ["RS256", "RS384", "RS512", "ES256", "ES384", "ES512"],
      issuer: process.env.KEYCLOAK_ISSUER ??
        `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`,
    });
    if (!tokenIssuedToPortal(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

export type UserRole =
  | "account_owner"
  | "account_admin"
  | "procurement_read_only"
  | "procurement_transact"
  | "buyer_view_only"
  | "buyer_request_quote"
  | "buyer_full_transact"
  | "inside_sales_read_only"
  | "inside_sales_transact";

// Roles a participant's account_owner may assign to their own users. Excludes
// account_owner (ownership transfer is not a self-service action) and any
// platform-level realm role such as haiwave_admin — assigning those would be a
// privilege escalation out of the tenant.
export const ASSIGNABLE_USER_ROLES: readonly UserRole[] = [
  "account_admin",
  "procurement_read_only",
  "procurement_transact",
  "buyer_view_only",
  "buyer_request_quote",
  "buyer_full_transact",
  "inside_sales_read_only",
  "inside_sales_transact",
];

export function isAssignableRole(role: string): role is UserRole {
  return (ASSIGNABLE_USER_ROLES as readonly string[]).includes(role);
}

export interface Session {
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    job_title: string;
  };
  participant: {
    id: string;
    company_name: string;
    status: string;
  };
  is_admin: boolean;
}

const PRIORITIZED_ROLES: UserRole[] = [
  "account_owner",
  "account_admin",
  "procurement_transact",
  "buyer_full_transact",
  "inside_sales_transact",
  "buyer_request_quote",
  "procurement_read_only",
  "inside_sales_read_only",
  "buyer_view_only"
];

/**
 * Resolve the portal role from the Keycloak realm roles on the token.
 * `haiwave_admin` maps to account_owner; otherwise the highest-priority
 * assignable role wins, defaulting to buyer_view_only.
 */
export function resolveUserRole(roles: string[]): UserRole {
  if (roles.includes("haiwave_admin")) return "account_owner";
  return PRIORITIZED_ROLES.find((r) => roles.includes(r)) ?? "buyer_view_only";
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("haiwave_session");
  if (!sessionCookie) return null;

  const value = sessionCookie.value;

  // If the cookie looks like a JWT (contains dots), verify its signature
  // against the Keycloak JWKS. An unverified decode would accept
  // caller-forged tokens including `alg: none`.
  if (value.includes(".")) {
    const payload = await verifySessionJwt(value);
    if (!payload) return null;

    const roles = (payload.realm_access as { roles?: string[] })?.roles ?? [];
    const isAdmin = roles.includes("haiwave_admin");

    const role = resolveUserRole(roles);

    return {
      user: {
        id: (payload.sub as string) ?? "",
        email: (payload.email as string) ?? "",
        first_name: (payload.given_name as string) ?? "",
        last_name: (payload.family_name as string) ?? "",
        role,
        job_title: "",
      },
      participant: {
        id: (payload.participant_id as string) ?? "",
        company_name: (payload.company_name as string) ?? "",
        status: "active",
      },
      is_admin: isAdmin,
    };
  }

  // A cookie value that is not a verifiable JWT only ever comes from the local
  // dev/demo login shim. In production it can only be caller-forged, so fail
  // closed: an unauthenticated request must not resolve to a session.
  if (process.env.NODE_ENV === "production") return null;

  return {
    user: MOCK_SESSION.user,
    participant: {
      id: MOCK_SESSION.participant.id,
      company_name: MOCK_SESSION.participant.company_name,
      status: MOCK_SESSION.participant.status,
    },
    is_admin: value === "admin",
  };
}

export async function getToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("haiwave_session");
  const value = sessionCookie?.value ?? null;

  // If the cookie is a real JWT, use it directly
  if (value && value.includes(".")) {
    return value;
  }

  // Dev mode: fetch a real Keycloak token via client credentials so BFF routes
  // can call haiCore instead of returning mock data. Opt-in via
  // DEV_KEYCLOAK_TOKEN=true, and never in production — a real service token
  // must not be mintable from a non-JWT cookie on a deployed environment.
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_KEYCLOAK_TOKEN === "true"
  ) {
    return getDevKeycloakToken();
  }

  return value;
}

let cachedDevToken: { token: string; expiresAt: number } | null = null;

async function getDevKeycloakToken(): Promise<string | null> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedDevToken && cachedDevToken.expiresAt > Date.now() + 60_000) {
    return cachedDevToken.token;
  }

  const tokenUrl = process.env.KEYCLOAK_TOKEN_ENDPOINT
    ?? "http://localhost:8080/realms/haiwave-network/protocol/openid-connect/token";
  const clientId = process.env.DEV_KEYCLOAK_CLIENT_ID ?? "demo-agent";
  const clientSecret = process.env.DEV_KEYCLOAK_CLIENT_SECRET ?? "demo-secret";

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { access_token: string; expires_in: number };
    cachedDevToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return cachedDevToken.token;
  } catch {
    return null;
  }
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  if (userRole === "account_owner") return true;

  if (requiredRole === "account_owner") {
    return false; // already handled above
  }

  if (requiredRole === "account_admin") {
    // These roles have "admin" level access to modify portal settings
    return [
      "account_admin", 
      "procurement_transact", 
      "buyer_full_transact", 
      "inside_sales_transact"
    ].includes(userRole);
  }

  return userRole === requiredRole;
}
