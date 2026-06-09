import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { authenticateUser } = vi.hoisted(() => ({ authenticateUser: vi.fn() }));
vi.mock('@/lib/keycloak', () => ({ authenticateUser }));

import { POST } from '../route';

function fakeJwt(payload: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

function loginReq(body: object): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/auth/login — is_admin in the response body', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports is_admin:true when the access token carries haiwave_admin', async () => {
    authenticateUser.mockResolvedValue({
      access_token: fakeJwt({ realm_access: { roles: ['offline_access', 'haiwave_admin'] } }),
      refresh_token: fakeJwt({ typ: 'Refresh' }),
      expires_in: 3600,
    });

    const res = await POST(loginReq({ email: 'admin@haiwave.ai', password: 'x' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, is_admin: true });
  });

  it('reports is_admin:false for a non-admin token', async () => {
    authenticateUser.mockResolvedValue({
      access_token: fakeJwt({ realm_access: { roles: ['uma_authorization'] } }),
      refresh_token: fakeJwt({ typ: 'Refresh' }),
      expires_in: 3600,
    });

    const res = await POST(loginReq({ email: 'user@example.com', password: 'x' }));
    expect(await res.json()).toMatchObject({ success: true, is_admin: false });
  });
});
