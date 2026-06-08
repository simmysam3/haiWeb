import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { endSession } = vi.hoisted(() => ({ endSession: vi.fn() }));
vi.mock('@/lib/keycloak', () => ({ endSession }));

import { GET } from '../route';

describe('GET /api/auth/logout', () => {
  it('redirects to PORTAL_BASE_URL/login (not request.url origin) and clears session cookies when no refresh cookie', async () => {
    // Simulate a Cloud Run internal URL — request.url origin differs from the public PORTAL_BASE_URL.
    // The canonical PORTAL_BASE_URL default is http://localhost:3001, so if the handler
    // incorrectly uses request.url it would redirect to http://cloud-run-internal.example.com/login.
    const req = new NextRequest('http://cloud-run-internal.example.com/api/auth/logout', { method: 'GET' });
    const res = await GET(req);

    // Must redirect to the canonical PORTAL_BASE_URL origin, NOT the internal request.url origin.
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    expect(location).toBe('http://localhost:3001/login');

    // Session cookies must be cleared
    const setCookies = res.headers.getSetCookie().join(' ');
    expect(setCookies).toContain('haiwave_session=');
    expect(setCookies).toContain('haiwave_refresh=');
    expect(setCookies).toMatch(/Max-Age=0|max-age=0/i);

    // No network call when there's no refresh token
    expect(endSession).not.toHaveBeenCalled();
  });
});
