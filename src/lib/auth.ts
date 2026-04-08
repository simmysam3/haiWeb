import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import { MOCK_SESSION } from "./mock-data";

export type UserRole =
  | "account_owner"
  | "account_admin"   // retained as permission reference level for hasRole checks
  | "procurement_read_only"
  | "procurement_transact"
  | "buyer_view_only"
  | "buyer_request_quote"
  | "buyer_full_transact"
  | "inside_sales_read_only"
  | "inside_sales_transact";

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
  "procurement_transact",
  "buyer_full_transact",
  "inside_sales_transact",
  "buyer_request_quote",
  "procurement_read_only",
  "inside_sales_read_only",
  "buyer_view_only"
];

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("haiwave_session");
  if (!sessionCookie) return null;

  const value = sessionCookie.value;

  // If the cookie looks like a JWT (contains dots), decode it
  if (value.includes(".")) {
    try {
      // NOTE: For full security, we should verify the signature here using jose.jwtVerify 
      // and the Keycloak public key (JWKS) rather than just decoding.
      const payload = decodeJwt(value);
      if (payload) {
        const roles = (payload.realm_access as { roles?: string[] })?.roles ?? [];
        const isAdmin = roles.includes("haiwave_admin");
        
        let role: UserRole = "buyer_view_only";
        if (isAdmin) {
          role = "account_owner";
        } else {
          const foundRole = PRIORITIZED_ROLES.find(r => roles.includes(r));
          if (foundRole) role = foundRole;
        }

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
    } catch {
      return null;
    }
  }

  // Fallback to mock session for development
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

  // Dev mode: fetch a real Keycloak token via client credentials
  // so BFF routes can call haiCore instead of returning mock data.
  // Requires explicit opt-in via DEV_KEYCLOAK_TOKEN=true.
  if (process.env.DEV_KEYCLOAK_TOKEN === "true") {
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
