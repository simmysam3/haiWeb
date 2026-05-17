import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { shouldRefreshSession } from "@/lib/session-refresh";

// v1.30 §10: 301 redirects from pre-Sonar URLs to the unified Observations page.
// Rules are ordered most-specific-first; first match wins.
const REDIRECTS: Array<{ from: RegExp; to: (path: string) => string }> = [
  // Pre-v1.27 monitoring path
  {
    from: /^\/account\/monitoring\/audit-nominations(\/.*)?$/,
    to: () => '/account/sonar/observations?tab=audit',
  },
  // Pre-v1.27 phantom-demand paths (if any v1.21 surface URLs still get hit)
  {
    from: /^\/account\/phantom-demand(\/.*)?$/,
    to: () => '/account/sonar/observations?tab=phantom_demand',
  },
];

// Sliding-session refresh ─────────────────────────────────────────────
// Login stores the Keycloak access token in `haiwave_session` (maxAge =
// access-token lifespan, ≈60 min) and the refresh token in `haiwave_refresh`
// (24 h). Nothing previously consumed the refresh token, so every session
// hard-died at the access-token lifespan regardless of activity — reads
// silently fell back to stale data while mutations 401'd. We now proactively
// exchange the refresh token when the access token is expired/near-expiry
// (or its short-lived cookie has already vanished), so an active session
// slides forward (bounded by Keycloak's ssoSessionMaxLifespan).
//
// On refresh failure we do NOT redirect API calls — the request proceeds,
// the BFF returns 401, and the UI's session-expired affordance prompts
// re-login. That avoids redirect loops on fetch() routes and keeps the
// failure legible rather than silent.

const SKEW_SECONDS = 120;
const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
const REALM = process.env.KEYCLOAK_REALM ?? 'haiwave-network';
const PORTAL_CLIENT_ID = process.env.KEYCLOAK_PORTAL_CLIENT_ID ?? 'haiwave-portal';
const TOKEN_URL = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;

interface RefreshedTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function exchangeRefreshToken(
  refreshToken: string,
): Promise<RefreshedTokens | null> {
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: PORTAL_CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as RefreshedTokens;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 301 redirects fire first so bookmarks and external links resolve to the
  // new URL without bouncing through /login (the auth check below).
  for (const rule of REDIRECTS) {
    if (rule.from.test(pathname)) {
      const url = new URL(rule.to(pathname), request.url);
      return NextResponse.redirect(url, 301);
    }
  }

  const sessionCookie = request.cookies.get('haiwave_session')?.value;
  const refreshCookie = request.cookies.get('haiwave_refresh')?.value;
  const isApi = pathname.startsWith('/api');

  // Attempt a sliding refresh before the presence check so an active user
  // whose access token (and its same-lived cookie) just lapsed is renewed
  // in-flight instead of being bounced to /login.
  let refreshed: RefreshedTokens | null = null;
  const decision = shouldRefreshSession({
    sessionCookie,
    refreshCookie,
    now: Date.now(),
    skewSeconds: SKEW_SECONDS,
  });
  if (decision.shouldRefresh && refreshCookie) {
    refreshed = await exchangeRefreshToken(refreshCookie);
  }

  const hasSession = Boolean(sessionCookie) || refreshed !== null;

  // Presence check for protected *page* routes. API routes must not 302 to
  // /login (it breaks fetch); they fall through and let the BFF answer 401.
  if (
    !isApi &&
    (pathname.startsWith('/account') || pathname.startsWith('/admin')) &&
    !hasSession
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!refreshed) {
    return NextResponse.next();
  }

  // Rotate both cookies AND mirror them onto the inbound request so the
  // Server Components / BFF in *this same* request already see the fresh
  // access token (response-only cookies wouldn't apply until next round-trip).
  request.cookies.set('haiwave_session', refreshed.access_token);
  request.cookies.set('haiwave_refresh', refreshed.refresh_token);
  const response = NextResponse.next({ request });
  const isProd = process.env.NODE_ENV === 'production';
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };
  response.cookies.set('haiwave_session', refreshed.access_token, {
    ...base,
    maxAge: refreshed.expires_in,
  });
  response.cookies.set('haiwave_refresh', refreshed.refresh_token, {
    ...base,
    maxAge: 86400,
  });
  return response;
}

export const config = {
  // Authenticated page surfaces + the account BFF (so XHR/mutations slide the
  // session too — the original symptom was POST /api/account/sonar/templates
  // 401ing on an expired token). /api/admin/* and /api/auth/* are excluded:
  // they do their own auth and must not be cookie-rotated mid-flight.
  matcher: ['/account/:path*', '/admin/:path*', '/api/account/:path*'],
};
