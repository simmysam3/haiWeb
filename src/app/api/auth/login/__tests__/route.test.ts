import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

function req(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('GET /api/auth/login — Authorization-Code redirect', () => {
  it('302s to the Keycloak authorize endpoint with PKCE + state + nonce cookies', async () => {
    const res = await GET(req('http://localhost:3001/api/auth/login'));
    expect(res.status).toBe(307); // NextResponse.redirect default
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toMatch(/\/protocol\/openid-connect\/auth$/);
    expect(loc.searchParams.get('response_type')).toBe('code');
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256');

    const setCookie = res.headers.getSetCookie().join('; ');
    expect(setCookie).toContain('kc_verifier=');
    expect(setCookie).toContain('kc_state=');
    expect(setCookie).toContain('kc_nonce=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/api/auth');
  });

  it('persists a safe ?next as the kc_next cookie and rejects an unsafe one', async () => {
    const ok = await GET(req('http://localhost:3001/api/auth/login?next=/account/agents'));
    expect(ok.headers.getSetCookie().join('; ')).toContain('kc_next=%2Faccount%2Fagents');

    const bad = await GET(req('http://localhost:3001/api/auth/login?next=//evil.com'));
    expect(bad.headers.getSetCookie().join('; ')).toContain('kc_next=%2Faccount');
  });
});
