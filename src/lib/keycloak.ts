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

export const keycloakAdminUrl = `${KEYCLOAK_URL}/admin/realms/${REALM}`;
export const keycloakTokenUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;

// TODO: Implement admin token acquisition
// TODO: Implement user CRUD operations
// TODO: Implement token exchange for login
