/**
 * Pure refresh-decision logic for the auth middleware.
 *
 * Kept separate from `middleware.ts` (which is hard to unit-test under
 * vitest) so the "do we need to refresh this session?" rule is verifiable
 * in isolation. Signature verification is intentionally NOT done here —
 * the middleware only needs the `exp` to decide whether to proactively
 * exchange the refresh token; `getSession()` still does full JWKS
 * verification on the resulting cookie.
 */

function isJwtLike(token: string | null | undefined): token is string {
  return !!token && token.split('.').length === 3;
}

// base64url → string, using `atob` so this runs unchanged on the Edge
// runtime (middleware) as well as Node. `Buffer` is not available on Edge.
function base64UrlDecode(seg: string): string {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

/** Read the `exp` (epoch seconds) from a JWT without verifying it. */
export function decodeJwtExp(token: string | null | undefined): number | null {
  if (!isJwtLike(token)) return null;
  try {
    const json = base64UrlDecode(token.split('.')[1]);
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

export interface RefreshDecisionInput {
  sessionCookie: string | undefined;
  refreshCookie: string | undefined;
  now: number;
  /** Refresh this many seconds *before* the token actually expires. */
  skewSeconds: number;
}

export interface RefreshDecision {
  shouldRefresh: boolean;
  reason:
    | 'mock-cookie'
    | 'no-refresh-token'
    | 'still-valid'
    | 'expiring'
    | 'session-gone';
}

export function shouldRefreshSession(input: RefreshDecisionInput): RefreshDecision {
  const { sessionCookie, refreshCookie, now, skewSeconds } = input;

  // Nothing to exchange — the refresh cookie is the only thing that can
  // mint a new session, so its absence is decisive.
  if (!refreshCookie) return { shouldRefresh: false, reason: 'no-refresh-token' };

  // The session cookie's maxAge equals the access-token lifespan, so once
  // the token expires the cookie itself is gone while the 24h refresh
  // cookie remains. An absent session + present refresh token is the
  // PRIMARY renewal case, not a dead end.
  if (!sessionCookie) return { shouldRefresh: true, reason: 'session-gone' };

  // Dev mock cookie ("user"/"admin"): not a JWT, nothing to refresh.
  if (!isJwtLike(sessionCookie)) return { shouldRefresh: false, reason: 'mock-cookie' };

  const exp = decodeJwtExp(sessionCookie);
  // Unparseable exp on a JWT-shaped token: treat as expiring so the
  // middleware attempts a refresh rather than letting it hard-fail.
  if (exp === null) return { shouldRefresh: true, reason: 'expiring' };

  const expiresInMs = exp * 1000 - now;
  if (expiresInMs <= skewSeconds * 1000) {
    return { shouldRefresh: true, reason: 'expiring' };
  }
  return { shouldRefresh: false, reason: 'still-valid' };
}
