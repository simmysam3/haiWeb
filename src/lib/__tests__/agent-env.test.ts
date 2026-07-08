import { describe, it, expect } from 'vitest';
import { toConfigEnvBlock, secretEnvLine } from '../agent-env';

const cred = {
  id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
  status: 'active' as const, registered_at: 'r', client_secret: 'sekret',
  auth_token_endpoint: 'https://auth/token', auth_issuer: 'https://auth/realm',
  auth_jwks_uri: 'https://auth/certs', api_base_url: 'https://api',
};

describe('toConfigEnvBlock', () => {
  it('emits every non-secret agent var under the real names', () => {
    const block = toConfigEnvBlock(cred);
    expect(block).toContain('PARTICIPANT_ID=pid');
    expect(block).toContain('AGENT_ID=aid');
    expect(block).toContain('KEYCLOAK_CLIENT_ID=agent-aid');
    expect(block).toContain('KEYCLOAK_TOKEN_ENDPOINT=https://auth/token');
    expect(block).toContain('KEYCLOAK_ISSUER=https://auth/realm');
    expect(block).toContain('KEYCLOAK_JWKS_URI=https://auth/certs');
    expect(block).toContain('HAICORE_BASE_URL=https://api');
    // never emit the spec's HAIWAVE_* names
    expect(block).not.toContain('HAIWAVE_CLIENT_SECRET');
  });

  it('carries a commented placeholder marking where the secret goes', () => {
    expect(toConfigEnvBlock(cred)).toMatch(/#\s*KEYCLOAK_CLIENT_SECRET=/);
  });

  it('NEVER contains the actual secret value', () => {
    // The config block is non-secret and re-downloadable; leaking the secret
    // into it would defeat the whole split.
    expect(toConfigEnvBlock(cred)).not.toContain('sekret');
  });
});

describe('secretEnvLine', () => {
  it('is exactly the one sensitive line, copy-paste ready', () => {
    expect(secretEnvLine(cred)).toBe('KEYCLOAK_CLIENT_SECRET=sekret');
  });
});
