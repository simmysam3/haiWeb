/**
 * Lightweight, dependency-free JWT claim readers.
 *
 * These DECODE (do not verify) a token's payload. They are only used on tokens
 * that were just obtained directly from Keycloak over TLS (e.g. the login
 * route deciding where to land the user), where a signature re-verification
 * would add a JWKS round-trip for no security gain. Never use these to make a
 * trust decision on a caller-supplied token — use `verifySessionJwt` for that.
 */

/** Decode a JWT payload without verifying its signature. Returns null on any malformation. */
function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = Buffer.from(part, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** True iff the access token carries the `haiwave_admin` realm role. */
export function isAdminFromAccessToken(token: string): boolean {
  const payload = decodePayload(token);
  const roles = (payload?.realm_access as { roles?: string[] } | undefined)?.roles;
  return Array.isArray(roles) && roles.includes('haiwave_admin');
}
