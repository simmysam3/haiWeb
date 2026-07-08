import { describe, it, expect } from 'vitest';
import { toEnvBlock } from '../agent-env';

describe('toEnvBlock', () => {
  it('emits the real agent-consumed variable names', () => {
    const block = toEnvBlock({
      id: 'aid', name: 'Bot', client_id: 'agent-aid', participant_id: 'pid',
      status: 'active', registered_at: 'r', client_secret: 'sekret',
      auth_token_endpoint: 'https://auth/token', auth_issuer: 'https://auth/realm',
      auth_jwks_uri: 'https://auth/certs', api_base_url: 'https://api',
    });
    expect(block).toContain('PARTICIPANT_ID=pid');
    expect(block).toContain('AGENT_ID=aid');
    expect(block).toContain('KEYCLOAK_CLIENT_ID=agent-aid');
    expect(block).toContain('KEYCLOAK_CLIENT_SECRET=sekret');
    expect(block).toContain('KEYCLOAK_TOKEN_ENDPOINT=https://auth/token');
    expect(block).toContain('KEYCLOAK_ISSUER=https://auth/realm');
    expect(block).toContain('KEYCLOAK_JWKS_URI=https://auth/certs');
    expect(block).toContain('HAICORE_BASE_URL=https://api');
    // never emit the spec's HAIWAVE_* names
    expect(block).not.toContain('HAIWAVE_CLIENT_SECRET');
  });
});
