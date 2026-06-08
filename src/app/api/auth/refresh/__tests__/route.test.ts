import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { refreshToken } = vi.hoisted(() => ({ refreshToken: vi.fn() }));
vi.mock('@/lib/keycloak', () => ({ refreshToken }));

import { POST } from '../route';

function refreshReq(): NextRequest {
  return new NextRequest('http://localhost/api/auth/refresh', {
    method: 'POST',
    headers: { cookie: 'haiwave_refresh=old-refresh-token' },
  });
}

describe('POST /api/auth/refresh — cookie security (SC-8)', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('sets Secure on the session + refresh cookies in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    refreshToken.mockResolvedValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    });

    const res = await POST(refreshReq());

    expect(res.status).toBe(200);
    expect(res.cookies.get('haiwave_session')?.secure).toBe(true);
    expect(res.cookies.get('haiwave_refresh')?.secure).toBe(true);
  });
});
