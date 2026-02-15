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

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("haiwave_session");
  if (!sessionCookie) return null;

  return {
    user: MOCK_SESSION.user,
    participant: {
      id: MOCK_SESSION.participant.id,
      company_name: MOCK_SESSION.participant.company_name,
      status: MOCK_SESSION.participant.status,
    },
    is_admin: sessionCookie.value === "admin",
  };
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
