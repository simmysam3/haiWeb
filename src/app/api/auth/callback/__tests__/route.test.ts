import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { exchangeCode, verifyIdTokenNonce } = vi.hoisted(() => ({
  exchangeCode: vi.fn(),
  verifyIdTokenNonce: vi.fn(),
}));
vi.mock('@/lib/oidc', () => ({ exchangeCode, verifyIdTokenNonce }));

import { GET } from '../route';

function enc(o: object) { return Buffer.from(JSON.stringify(o)).toString('base64url'); }
function fakeJwt(payload: object) { return `${enc({ alg: 'RS256' })}.${enc(payload)}.sig`; }

function cbReq(qs: string, cookies: Record<string, string>): NextRequest {
  const cookie = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  return new NextRequest(`http://localhost:3001/api/auth/callback?${qs}`, {
    method: 'GET',
    headers: { cookie },
  });
}

describe('GET /api/auth/callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a state mismatch and redirects to /login?error=state', async () => {
    const res = await GET(cbReq('code=abc&state=evil', { kc_state: 'real', kc_verifier: 'v', kc_nonce: 'n' }));
    expect(res.headers.get('location')).toContain('/login?error=state');
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it('on valid code: exchanges, verifies nonce, sets session cookies, redirects', async () => {
    exchangeCode.mockResolvedValue({
      access_token: fakeJwt({ realm_access: { roles: ['buyer_view_only'] } }),
      refresh_token: 'refresh-xyz',
      id_token: fakeJwt({ nonce: 'n' }),
      expires_in: 3600,
    });
    verifyIdTokenNonce.mockResolvedValue(undefined);

    const res = await GET(cbReq('code=abc&state=real', {
      kc_state: 'real', kc_verifier: 'v', kc_nonce: 'n', kc_next: '/account/agents',
    }));
    expect(res.headers.get('location')).toBe('http://localhost:3001/account/agents');
    const setCookie = res.headers.getSetCookie().join('; ');
    expect(setCookie).toContain('haiwave_session=');
    expect(setCookie).toContain('haiwave_refresh=refresh-xyz');
    expect(setCookie).toContain('kc_verifier=;');
  });

  it('routes admins to the gatekeeper console', async () => {
    exchangeCode.mockResolvedValue({
      access_token: fakeJwt({ realm_access: { roles: ['haiwave_admin'] } }),
      refresh_token: 'r', id_token: fakeJwt({ nonce: 'n' }), expires_in: 3600,
    });
    verifyIdTokenNonce.mockResolvedValue(undefined);
    const res = await GET(cbReq('code=abc&state=real', { kc_state: 'real', kc_verifier: 'v', kc_nonce: 'n' }));
    expect(res.headers.get('location')).toBe('http://localhost:3001/account/admin/registrations');
  });

  it('redirects to /login?error=exchange when the token exchange throws', async () => {
    exchangeCode.mockRejectedValue(new Error('boom'));
    const res = await GET(cbReq('code=abc&state=real', { kc_state: 'real', kc_verifier: 'v', kc_nonce: 'n' }));
    expect(res.headers.get('location')).toContain('/login?error=exchange');
  });

  it('does not set a session when nonce verification fails (token-stuffing defense)', async () => {
    exchangeCode.mockResolvedValue({
      access_token: fakeJwt({ realm_access: { roles: ['buyer_view_only'] } }),
      refresh_token: 'r', id_token: fakeJwt({ nonce: 'WRONG' }), expires_in: 3600,
    });
    verifyIdTokenNonce.mockRejectedValue(new Error('nonce mismatch'));
    const res = await GET(cbReq('code=abc&state=real', { kc_state: 'real', kc_verifier: 'v', kc_nonce: 'n' }));
    expect(res.headers.get('location')).toContain('/login?error=exchange');
    const setCookie = res.headers.getSetCookie().join('; ');
    expect(setCookie).not.toContain('haiwave_session=ey');
    expect(setCookie).not.toContain('haiwave_refresh=r');
  });
});
