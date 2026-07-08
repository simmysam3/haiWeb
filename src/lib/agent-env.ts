import type { AgentCredential } from './haiwave-api';

/**
 * Composes the `.env` block an operator drops into their agent deployment.
 * Variable names match what the real agent client reads (see haiClient's
 * env contract) — NOT the spec's placeholder `HAIWAVE_*` names.
 */
export function toEnvBlock(c: AgentCredential): string {
  return [
    `PARTICIPANT_ID=${c.participant_id}`,
    `AGENT_ID=${c.id}`,
    `KEYCLOAK_CLIENT_ID=${c.client_id}`,
    `KEYCLOAK_CLIENT_SECRET=${c.client_secret}`,
    `KEYCLOAK_TOKEN_ENDPOINT=${c.auth_token_endpoint}`,
    `KEYCLOAK_ISSUER=${c.auth_issuer}`,
    `KEYCLOAK_JWKS_URI=${c.auth_jwks_uri}`,
    `HAICORE_BASE_URL=${c.api_base_url}`,
  ].join('\n');
}
