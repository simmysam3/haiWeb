import { NextRequest, NextResponse } from 'next/server';
import { loadEnv } from '@/config/env';
import { randomToken, pkceChallenge, buildAuthorizeUrl } from '@/lib/oidc';

/**
 * GET /api/auth/login
 *
 * Starts the OIDC Authorization-Code + PKCE flow: stashes verifier/state/nonce
 * in short-lived httpOnly cookies and redirects (307) the browser to Keycloak.
 */
/**
 * Return a safe in-portal redirect path. Rejects anything the URL parser would
 * resolve to a different origin — protocol-relative (`//host`), backslash variants
 * (`/\host`), and absolute/scheme URLs — to defend against open redirects.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/account';
  try {
    const u = new URL(raw, 'http://localhost');
    if (u.origin !== 'http://localhost') return '/account';
  } catch {
    return '/account';
  }
  return raw.replace(/[\r\n]/g, '');
}

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
  const opts = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, maxAge: 600, path: '/api/auth' };
  res.cookies.set('kc_verifier', verifier, opts);
  res.cookies.set('kc_state', state, opts);
  res.cookies.set('kc_nonce', nonce, opts);
  res.cookies.set('kc_next', next, opts);
  return res;
}
