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
  return sessionCookie?.value ?? null;
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  if (userRole === "account_owner") return true;

  if (requiredRole === "account_owner") {
    return userRole === "account_owner";
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
