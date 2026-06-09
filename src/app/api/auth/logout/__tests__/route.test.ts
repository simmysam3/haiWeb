import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { endSession } = vi.hoisted(() => ({ endSession: vi.fn() }));
vi.mock('@/lib/keycloak', () => ({ endSession }));

import * as route from '../route';

describe('/api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks());

  // Logout mutates state (ends the Keycloak session + clears cookies). It must
  // NOT be reachable via GET: Next's router prefetches visible <Link>s, and a
  // GET prefetch of a destructive logout route silently logged the user out
  // (forced re-login when moving between pages). Logout is POST-only.
  it('does not expose a destructive GET handler', () => {
    expect((route as Record<string, unknown>).GET).toBeUndefined();
  });

  it('POST ends the session, clears cookies, and 303-redirects to PORTAL_BASE_URL/login', async () => {
    // Internal Cloud Run origin differs from the public PORTAL_BASE_URL; the
    // handler must redirect to the canonical base, not request.url's origin.
    const req = new NextRequest('http://cloud-run-internal.example.com/api/auth/logout', {
      method: 'POST',
      headers: { cookie: 'haiwave_refresh=rt-123' },
    });
    const res = await route.POST(req);

    // 303 See Other so the browser turns the POST into a GET on /login
    // (a 307/308 would re-POST to /login).
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3001/login');

    const setCookies = res.headers.getSetCookie().join(' ');
    expect(setCookies).toContain('haiwave_session=');
    expect(setCookies).toContain('haiwave_refresh=');
    expect(setCookies).toMatch(/Max-Age=0|max-age=0/i);

    // Back-channel Keycloak session termination with the refresh token.
    expect(endSession).toHaveBeenCalledWith('rt-123');
  });

  it('POST still clears cookies and redirects when there is no refresh cookie', async () => {
    const req = new NextRequest('http://localhost:3001/api/auth/logout', { method: 'POST' });
    const res = await route.POST(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('http://localhost:3001/login');
    expect(endSession).not.toHaveBeenCalled();
  });
});
