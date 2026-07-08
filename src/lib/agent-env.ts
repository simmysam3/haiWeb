import type { AgentCredential } from './haiwave-api';

/**
 * The single sensitive line — the client secret. This is the only value that is
 * shown once and can never be viewed again; it belongs in a secret store.
 * Rendered as a full `KEY=value` line so it pastes straight into a `.env`.
 */
export function secretEnvLine(c: Pick<AgentCredential, 'client_secret'>): string {
  return `KEYCLOAK_CLIENT_SECRET=${c.client_secret}`;
}

/**
 * The non-secret agent config `.env` — every variable EXCEPT the client secret,
 * plus a commented placeholder marking where the secret slots in. These values
 * are non-sensitive and stable, so this block can be shown/re-downloaded anytime.
 *
 * The parameter type omits `client_secret`, so the secret is structurally
 * unable to leak into this block. Variable names match what the real agent
 * client reads (haiClient's env contract), NOT the spec's placeholder
 * `HAIWAVE_*` names.
 */
export function toConfigEnvBlock(c: Omit<AgentCredential, 'client_secret'>): string {
  return [
    `PARTICIPANT_ID=${c.participant_id}`,
    `AGENT_ID=${c.id}`,
    `KEYCLOAK_CLIENT_ID=${c.client_id}`,
    `KEYCLOAK_TOKEN_ENDPOINT=${c.auth_token_endpoint}`,
    `KEYCLOAK_ISSUER=${c.auth_issuer}`,
    `KEYCLOAK_JWKS_URI=${c.auth_jwks_uri}`,
    `HAICORE_BASE_URL=${c.api_base_url}`,
    `# KEYCLOAK_CLIENT_SECRET=  # paste from the one-time reveal (or your secret store)`,
  ].join('\n');
}
