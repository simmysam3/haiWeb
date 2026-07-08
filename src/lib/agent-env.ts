import type { AgentCredential, AgentSummary } from './haiwave-api';

/** The non-secret fields the agent config `.env` is built from. */
export interface AgentEnvConfig {
  participant_id: string;
  id: string;
  client_id: string;
  auth_token_endpoint: string;
  auth_issuer: string;
  auth_jwks_uri: string;
  api_base_url: string;
}

/**
 * The single sensitive line — the client secret. This is the only value that is
 * shown once and can never be viewed again; it belongs in a secret store.
 * Rendered as a full `KEY=value` line so it pastes straight into a `.env`.
 */
export function secretEnvLine(c: Pick<AgentCredential, 'client_secret'>): string {
  return `KEYCLOAK_CLIENT_SECRET=${c.client_secret}`;
}

/**
 * Build the config input from a list summary. The summary's endpoints are
 * optional (an older haiCore omits them); returns null when they are absent, so
 * the caller can hide the re-download rather than emit a broken `.env`.
 */
export function summaryConfig(a: AgentSummary): AgentEnvConfig | null {
  if (!a.auth_token_endpoint || !a.auth_issuer || !a.auth_jwks_uri || !a.api_base_url) {
    return null;
  }
  return {
    participant_id: a.participant_id,
    id: a.id,
    client_id: a.client_id,
    auth_token_endpoint: a.auth_token_endpoint,
    auth_issuer: a.auth_issuer,
    auth_jwks_uri: a.auth_jwks_uri,
    api_base_url: a.api_base_url,
  };
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
export function toConfigEnvBlock(c: AgentEnvConfig): string {
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
