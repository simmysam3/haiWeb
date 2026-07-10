import type { UserRole } from "./auth";

/**
 * The account-users DTO the console renders (snake_case, matching the haiCore
 * JSON contract). Keycloak returns a different (camelCase) representation, so
 * the BFF maps every user through `toAccountUser` before returning it.
 */
export interface AccountUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  job_title: string;
  phone: string;
  status: "active" | "disabled";
  last_login: string;
}

/** Subset of the Keycloak user representation we consume. */
export interface KeycloakUserRep {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  attributes?: Record<string, string[] | undefined>;
}

const DEFAULT_ROLE: UserRole = "buyer_view_only";

/** Map a raw Keycloak user representation to the account-users DTO. */
export function toAccountUser(kc: KeycloakUserRep): AccountUser {
  const attrs = kc.attributes ?? {};
  return {
    id: kc.id,
    email: kc.email ?? "",
    first_name: kc.firstName ?? "",
    last_name: kc.lastName ?? "",
    role: (attrs.role?.[0] as UserRole | undefined) ?? DEFAULT_ROLE,
    job_title: attrs.job_title?.[0] ?? "",
    phone: attrs.phone?.[0] ?? "",
    status: kc.enabled === false ? "disabled" : "active",
    // Keycloak's user representation doesn't carry a last-login timestamp; the
    // console shows "Never" until a login-events source is wired.
    last_login: "Never",
  };
}
