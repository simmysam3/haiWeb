import { describe, it, expect } from 'vitest';
import { randomToken, pkceChallenge, buildAuthorizeUrl } from '../oidc';

describe('oidc helpers', () => {
  it('randomToken returns distinct base64url strings', () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThanOrEqual(43); // base64url of 32 bytes ≥ 43 chars (entropy floor)
  });

  it('pkceChallenge is the base64url SHA-256 of the verifier (S256)', async () => {
    // RFC 7636 Appendix B fixed vector
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await pkceChallenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('buildAuthorizeUrl sets response_type=code and S256', () => {
    const url = new URL(buildAuthorizeUrl({
      redirectUri: 'http://localhost:3001/api/auth/callback',
      state: 's', nonce: 'n', codeChallenge: 'c',
    }));
    expect(url.pathname).toMatch(/\/protocol\/openid-connect\/auth$/);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('c');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3001/api/auth/callback');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('state')).toBe('s');
    expect(url.searchParams.get('nonce')).toBe('n');
  });
});
