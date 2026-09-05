import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// `src/proxy.ts` reads the env once at module scope, so the secret has to be
// in place before the static import below is evaluated.
const PORTAL_SECRET = vi.hoisted(() => {
  process.env.KEYCLOAK_CLIENT_SECRET = 'portal-secret-under-test';
  return process.env.KEYCLOAK_CLIENT_SECRET;
});

import { proxy } from './proxy';

/** An unsigned RS256-shaped JWT whose exp is `secondsFromNow` ahead. */
function jwt(secondsFromNow: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

function requestWithExpiringSession(path: string): NextRequest {
  return new NextRequest(new URL(path, 'https://console.haiwave.ai'), {
    headers: { cookie: `haiwave_session=${jwt(30)}; haiwave_refresh=rt-1` },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proxy sliding refresh — the refresh_token grant (SEC-web-core-1-01)', () => {
  it('sends the portal client secret with the refresh_token grant', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'at-2', refresh_token: 'rt-2', expires_in: 300 }),
      text: async () => '',
    });

    await proxy(requestWithExpiringSession('/account/profile'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt-1');
    expect(body.get('client_secret')).toBe(PORTAL_SECRET);
  });

  it('logs a refused exchange with the status and body Keycloak returned', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_client' }),
      text: async () => '{"error":"invalid_client"}',
    });

    await proxy(requestWithExpiringSession('/api/account/profile'));

    expect(error).toHaveBeenCalledTimes(1);
    const logged = error.mock.calls[0].map(String).join(' ');
    expect(logged).toContain('[proxy] refresh exchange failed');
    expect(logged).toContain('401');
    expect(logged).toContain('invalid_client');
    error.mockRestore();
  });

  it('logs an exchange that throws (network failure) instead of swallowing it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED keycloak:8080'));

    await proxy(requestWithExpiringSession('/api/account/profile'));

    expect(error).toHaveBeenCalledTimes(1);
    const logged = error.mock.calls[0].map(String).join(' ');
    expect(logged).toContain('[proxy] refresh exchange threw');
    expect(logged).toContain('ECONNREFUSED keycloak:8080');
    error.mockRestore();
  });

  // Pin (passed on first run): a refused refresh must not turn an API request
  // into a login redirect — the BFF answers 401 itself.
  it('lets an API request proceed without a redirect when the refresh is refused', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_client' }),
      text: async () => '{"error":"invalid_client"}',
    });

    const res = await proxy(requestWithExpiringSession('/api/account/profile'));

    expect(res.status).not.toBe(307);
    expect(res.headers.get('location')).toBeNull();
    vi.restoreAllMocks();
  });
});
