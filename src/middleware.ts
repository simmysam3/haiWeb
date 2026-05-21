import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { shouldRefreshSession } from "@/lib/session-refresh";

// v1.30 §10: 301 redirects from pre-Sonar URLs to the unified Observations page.
// Rules are ordered most-specific-first; first match wins.
//
// v1.37 IA split — Compliance was decomposed into two top-level Sonar
// sections: Request Management (`/account/sonar/requests/*`) and Posture
// (`/account/sonar/posture/*`). The legacy `/account/sonar/compliance/*`
// paths are redirected here. Earlier rules (v1.30/v1.34/v1.35) were
// retargeted to the NEW v1.37 URLs to preserve the single-301-hop
// invariant the redirect tests enforce.
const REDIRECTS: Array<{ from: RegExp; to: (path: string) => string }> = [
  // v1.35→v1.37: legacy pre-v1.27 monitoring URL retargeted to the v1.37
  // Request Management active queue (was the v1.35 /compliance/requests URL).
  {
    from: /^\/account\/monitoring\/audit-nominations(\/.*)?$/,
    to: () => '/account/sonar/requests?awaiting=me&type=nomination',
  },
  // Pre-v1.27 phantom-demand paths (if any v1.21 surface URLs still get hit)
  {
    from: /^\/account\/phantom-demand(\/.*)?$/,
    to: () => '/account/sonar/observations?tab=phantom_demand',
  },
  // Retired v1.21 PD usage/forecast dashboard. Only the bare prefix and
  // /dashboard are dead — /runs/* and /reports/* are live canonical surfaces
  // under the same prefix and must NOT match.
  {
    from: /^\/account\/sonar\/phantom-demand(\/dashboard)?\/?$/,
    to: () => '/account/sonar/observations?tab=phantom_demand',
  },
  // v1.35→v1.37 — new-nomination form lives at /sonar/requests/new-nomination.
  // Listed BEFORE the bare /posture/nominations rule so the more-specific
  // /new path wins (the bare rule's `\/?$` anchor already prevents it from
  // matching /new, but explicit ordering keeps the intent legible).
  {
    from: /^\/account\/sonar\/compliance\/posture\/nominations\/new\/?$/,
    to: () => '/account/sonar/requests/new-nomination',
  },
  // v1.35→v1.37 — outbound nominations page = the awaiting-them filter on
  // the Request Management active queue.
  {
    from: /^\/account\/sonar\/compliance\/posture\/nominations\/?$/,
    to: () =>
      '/account/sonar/requests?awaiting=them&type=nomination',
  },
  // v1.34→v1.37 §12.1: legacy /account/sonar/audit/* now lands on the v1.37
  // Posture/Request-Management split. Specific surfaces first; the catch-all
  // /audit rewrite stays LAST and is bypassed by every preceding rule.
  //
  // v1.37 R2 — /audit/dashboard now lands on the Sonar Dashboard (where the
  // full coverage surface lives post-R2), not Posture. Intent of the legacy
  // URL was "audit dashboard view"; the Sonar Dashboard with coverage on top
  // is the closer R2 analogue than the workflow-only Posture section.
  {
    from: /^\/account\/sonar\/audit\/dashboard\/?$/,
    to: () => '/account/sonar/dashboard',
  },
  // v1.34→v1.37: /audit/nominations* lands directly on Request Management.
  {
    from: /^\/account\/sonar\/audit\/nominations(\/.*)?$/,
    to: (p) => {
      // Anchor the /new check to the SUFFIX after /audit/nominations so a
      // hypothetical nested segment like /audit/nominations/foo/new can't
      // accidentally route to the new-nomination form. Only an exact
      // /new or /new/<sub> tail qualifies.
      const suffix = p.replace(/^\/account\/sonar\/audit\/nominations/, '');
      if (/^\/new(\/.*)?$/.test(suffix)) {
        return '/account/sonar/requests/new-nomination';
      }
      return '/account/sonar/requests?awaiting=them&type=nomination';
    },
  },
  {
    from: /^\/account\/sonar\/audit\/downstream-gaps(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/audit\/downstream-gaps/,
        '/account/sonar/posture/obligations',
      ),
  },
  // v1.34→v1.37: /audit/runs|reports|trust-bypass land on their v1.37 homes.
  // Listed BEFORE the generic /audit catch-all so the specific routes win.
  {
    from: /^\/account\/sonar\/audit\/runs(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/audit\/runs/,
        '/account/sonar/posture/runs',
      ),
  },
  {
    from: /^\/account\/sonar\/audit\/reports(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/audit\/reports/,
        '/account/sonar/reports',
      ),
  },
  {
    from: /^\/account\/sonar\/audit\/trust-bypass(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/audit\/trust-bypass/,
        '/account/sonar/posture/trust-bypass',
      ),
  },
  // v1.34 catch-all (everything else under /audit) → v1.37 posture root.
  // Last in the /audit cluster so the specific rules above win.
  {
    from: /^\/account\/sonar\/audit(\/.*)?$/,
    to: () => '/account/sonar/posture',
  },
  // ───────────── v1.37 §1: /sonar/compliance/* → split sections ─────────────
  // Order: most-specific FIRST. The bare /compliance prefix collapses to
  // Request Management (active queue is the user-facing default landing).
  // Sub-paths are rewritten via String#replace so query strings + nested
  // segments (e.g. /requests/declined?days=30) survive.
  //
  // v1.37 — evidence draft/responses moved under Request Management.
  {
    from: /^\/account\/sonar\/compliance\/evidence(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/compliance\/evidence/,
        '/account/sonar/requests/evidence',
      ),
  },
  // v1.37 R2 — Coverage moved out of Posture and into the Sonar Dashboard.
  // Legacy /compliance/posture/coverage now lands directly on the new home
  // at /sonar/dashboard. Listed BEFORE the generic /posture catch-all so
  // the coverage→dashboard mapping wins.
  {
    from: /^\/account\/sonar\/compliance\/posture\/coverage\/?$/,
    to: () => '/account/sonar/dashboard',
  },
  // v1.37 R2 — same retarget for the post-R1 URL: anyone who bookmarked the
  // R1-era /sonar/posture/coverage (or links lingering from that brief
  // window) now lands on /sonar/dashboard in one hop.
  {
    from: /^\/account\/sonar\/posture\/coverage\/?$/,
    to: () => '/account/sonar/dashboard',
  },
  // v1.37 — all other Posture sub-routes (working-list, changes, obligations).
  {
    from: /^\/account\/sonar\/compliance\/posture(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/compliance\/posture/,
        '/account/sonar/posture',
      ),
  },
  // v1.37 — runs moved under Posture (audit history).
  {
    from: /^\/account\/sonar\/compliance\/runs(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/compliance\/runs/,
        '/account/sonar/posture/runs',
      ),
  },
  // v1.37 — report detail pages moved to the top-level Reports section.
  {
    from: /^\/account\/sonar\/compliance\/reports(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/compliance\/reports/,
        '/account/sonar/reports',
      ),
  },
  // v1.37 — trust-bypass moved under Posture.
  {
    from: /^\/account\/sonar\/compliance\/trust-bypass(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/compliance\/trust-bypass/,
        '/account/sonar/posture/trust-bypass',
      ),
  },
  // v1.37 — requests (Active queue + Declined + new-nomination) moved up.
  {
    from: /^\/account\/sonar\/compliance\/requests(\/.*)?$/,
    to: (p) =>
      p.replace(
        /^\/account\/sonar\/compliance\/requests/,
        '/account/sonar/requests',
      ),
  },
  // v1.37 catch-all — the bare /compliance hub is gone; lands users on the
  // Request Management active queue (the default landing page). Last in
  // the /compliance cluster so every specific rule above wins.
  {
    from: /^\/account\/sonar\/compliance(\/.*)?$/,
    to: () => '/account/sonar/requests',
  },
];

/**
 * Pure redirect lookup — returns the target path for `pathname` if any rule
 * matches, otherwise null. Extracted from the Next.js middleware so unit
 * tests can exercise the rule table without booting NextRequest/fetch.
 */
export function applyRedirects(pathname: string): string | null {
  for (const rule of REDIRECTS) {
    if (rule.from.test(pathname)) {
      return rule.to(pathname);
    }
  }
  return null;
}

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
  const redirectTo = applyRedirects(pathname);
  if (redirectTo !== null) {
    return NextResponse.redirect(new URL(redirectTo, request.url), 301);
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
