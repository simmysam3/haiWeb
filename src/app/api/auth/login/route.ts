import { NextRequest, NextResponse } from 'next/server';
import { loadEnv } from '@/config/env';
import { randomToken, pkceChallenge, buildAuthorizeUrl } from '@/lib/oidc';
import { safeNext } from '@/lib/safe-next';

/**
 * GET /api/auth/login
 *
 * Starts the OIDC Authorization-Code + PKCE flow: stashes verifier/state/nonce
 * in short-lived httpOnly cookies and redirects (307) the browser to Keycloak.
 */

export async function GET(request: NextRequest) {
  const env = loadEnv();
  const isProd = env.NODE_ENV === 'production';

  const verifier = randomToken(32);
  const state = randomToken(16);
  const nonce = randomToken(16);
  const challenge = await pkceChallenge(verifier);
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const redirectUri = `${env.PORTAL_BASE_URL}/api/auth/callback`;

  const res = NextResponse.redirect(buildAuthorizeUrl({ redirectUri, state, nonce, codeChallenge: challenge }));
  // 30 min: long enough for a slow login (e.g. sitting on the Keycloak passkey
  // prompt) so the CSRF cookies don't lapse mid-flow and bounce to error=state.
  const opts = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, maxAge: 1800, path: '/api/auth' };
  res.cookies.set('kc_verifier', verifier, opts);
  res.cookies.set('kc_state', state, opts);
  res.cookies.set('kc_nonce', nonce, opts);
  res.cookies.set('kc_next', next, opts);
  return res;
}
