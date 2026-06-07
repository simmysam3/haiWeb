import { describe, it, expect } from 'vitest';
import { isAdminFromAccessToken } from '../jwt-claims';

/** Build a fake JWT (header.payload.signature) with the given claims payload. */
function fakeJwt(payload: object): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

describe('isAdminFromAccessToken', () => {
  it('returns true when realm_access.roles includes haiwave_admin', () => {
    const token = fakeJwt({
      realm_access: { roles: ['offline_access', 'haiwave_admin', 'uma_authorization'] },
    });
    expect(isAdminFromAccessToken(token)).toBe(true);
  });

  it('returns false when haiwave_admin is absent', () => {
    const token = fakeJwt({ realm_access: { roles: ['offline_access', 'uma_authorization'] } });
    expect(isAdminFromAccessToken(token)).toBe(false);
  });

  it('returns false when realm_access is missing', () => {
    expect(isAdminFromAccessToken(fakeJwt({ sub: 'abc' }))).toBe(false);
  });

  it('returns false for a malformed or empty token', () => {
    expect(isAdminFromAccessToken('not-a-jwt')).toBe(false);
    expect(isAdminFromAccessToken('')).toBe(false);
  });
});
