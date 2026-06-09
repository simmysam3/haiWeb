import { NextRequest, NextResponse } from 'next/server';
import { loadEnv } from '@/config/env';
import { exchangeCode, verifyIdTokenNonce } from '@/lib/oidc';
import { isAdminFromAccessToken } from '@/lib/jwt-claims';

const TEMP_COOKIES = ['kc_verifier', 'kc_state', 'kc_nonce', 'kc_next', 'kc_retry'] as const;

function clearTemp(res: NextResponse): NextResponse {
  for (const c of TEMP_COOKIES) {
    res.cookies.set(c, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/api/auth' });
  }
  return res;
}

export async function GET(request: NextRequest) {
  const env = loadEnv();
  const isProd = env.NODE_ENV === 'production';
  const base = env.PORTAL_BASE_URL;

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get('kc_state')?.value;
  const verifier = request.cookies.get('kc_verifier')?.value;
  const nonce = request.cookies.get('kc_nonce')?.value;
  const next = request.cookies.get('kc_next')?.value ?? '/account';

  // Separate a genuinely bad callback from the benign "CSRF cookies expired"
  // case. The kc_* cookies are short-lived; if the user sits on the Keycloak
  // login (common with passkeys) they lapse, yet Keycloak still returns a valid
  // code+state against a live SSO session. A malformed callback or a real state
  // MISMATCH is not recoverable → error page. Expired cookies (state/verifier/
  // nonce simply absent) ARE recoverable → restart the flow ONCE, guarded by
  // kc_retry so a persistently-failing case can't loop. This keeps the user from
  // seeing /login?error=state for a login that actually succeeds on retry.
  const malformed = !code || !state;
  const mismatch = !!cookieState && state !== cookieState;
  const cookiesExpired = !cookieState || !verifier || !nonce;

  if (malformed || mismatch) {
    return clearTemp(NextResponse.redirect(`${base}/login?error=state`));
  }
  if (cookiesExpired) {
    if (request.cookies.get('kc_retry')?.value) {
      // Already auto-retried and the cookies STILL didn't take → real problem;
      // show the manual error page (clearTemp resets kc_retry too).
      return clearTemp(NextResponse.redirect(`${base}/login?error=state`));
    }
    const res = clearTemp(NextResponse.redirect(`${base}/api/auth/login`));
    res.cookies.set('kc_retry', '1', { httpOnly: true, secure: isProd, sameSite: 'lax', maxAge: 120, path: '/api/auth' });
    return res;
  }

  let tokens;
  try {
    tokens = await exchangeCode({ code, codeVerifier: verifier, redirectUri: `${base}/api/auth/callback` });
    await verifyIdTokenNonce(tokens.id_token, nonce);
  } catch {
    return clearTemp(NextResponse.redirect(`${base}/login?error=exchange`));
  }

  const dest = isAdminFromAccessToken(tokens.access_token) ? '/account/admin/registrations' : next;
  const res = NextResponse.redirect(`${base}${dest}`);
  const sessOpts = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, path: '/' };
  res.cookies.set('haiwave_session', tokens.access_token, { ...sessOpts, maxAge: tokens.expires_in });
  res.cookies.set('haiwave_refresh', tokens.refresh_token, { ...sessOpts, maxAge: 86400 });
  return clearTemp(res);
}
