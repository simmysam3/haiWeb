import { cookies } from "next/headers";
import { MOCK_SESSION } from "./mock-data";

export type UserRole = "account_owner" | "account_admin" | "account_viewer";

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

const ROLE_HIERARCHY: Record<UserRole, number> = {
  account_viewer: 0,
  account_admin: 1,
  account_owner: 2,
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("haiwave_session");
  if (!sessionCookie) return null;

  const value = sessionCookie.value;

  // If the cookie looks like a JWT (contains dots), decode it
  if (value.includes(".")) {
    const payload = decodeJwtPayload(value);
    if (payload) {
      const roles = (payload.realm_access as { roles?: string[] })?.roles ?? [];
      const isAdmin = roles.includes("haiwave_admin");
      const role: UserRole = isAdmin
        ? "account_owner"
        : roles.includes("account_admin")
          ? "account_admin"
          : "account_viewer";

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
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
