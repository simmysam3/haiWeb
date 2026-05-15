import { describe, it, expect } from 'vitest';
import { decodeJwtExp, shouldRefreshSession } from '../session-refresh';

function jwt(expSecondsFromNow: number, now = Date.now()): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(now / 1000) + expSecondsFromNow }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('decodeJwtExp', () => {
  it('reads exp (seconds) from a JWT payload without verifying signature', () => {
    const now = 1_700_000_000_000;
    expect(decodeJwtExp(jwt(300, now))).toBe(Math.floor(now / 1000) + 300);
  });
  it('returns null for a non-JWT / malformed token', () => {
    expect(decodeJwtExp('user')).toBeNull();
    expect(decodeJwtExp('a.b')).toBeNull();
    expect(decodeJwtExp('a.%%%.c')).toBeNull();
    expect(decodeJwtExp(null)).toBeNull();
  });
});

describe('shouldRefreshSession', () => {
  const now = 1_700_000_000_000;
  const refresh = 'refresh-token-value';

  it('refreshes when the access token is within the skew window', () => {
    const r = shouldRefreshSession({
      sessionCookie: jwt(30, now),
      refreshCookie: refresh,
      now,
      skewSeconds: 120,
    });
    expect(r.shouldRefresh).toBe(true);
  });

  it('refreshes when the access token is already expired', () => {
    expect(
      shouldRefreshSession({ sessionCookie: jwt(-60, now), refreshCookie: refresh, now, skewSeconds: 120 }).shouldRefresh,
    ).toBe(true);
  });

  it('does NOT refresh when the token is comfortably valid', () => {
    expect(
      shouldRefreshSession({ sessionCookie: jwt(900, now), refreshCookie: refresh, now, skewSeconds: 120 }).shouldRefresh,
    ).toBe(false);
  });

  it('does NOT refresh the dev mock cookie (non-JWT)', () => {
    expect(
      shouldRefreshSession({ sessionCookie: 'user', refreshCookie: refresh, now, skewSeconds: 120 }).shouldRefresh,
    ).toBe(false);
  });

  it('does NOT refresh when there is no refresh token (nothing to exchange)', () => {
    const r = shouldRefreshSession({ sessionCookie: jwt(-60, now), refreshCookie: undefined, now, skewSeconds: 120 });
    expect(r.shouldRefresh).toBe(false);
    expect(r.reason).toBe('no-refresh-token');
  });

  it('DOES refresh when the session cookie is gone but a refresh token remains (token+cookie expired together)', () => {
    const r = shouldRefreshSession({ sessionCookie: undefined, refreshCookie: refresh, now, skewSeconds: 120 });
    expect(r.shouldRefresh).toBe(true);
    expect(r.reason).toBe('session-gone');
  });
});
