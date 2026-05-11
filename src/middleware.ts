import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 301 redirects fire first so bookmarks and external links resolve to the
  // new URL without bouncing through /login (the auth check below).
  for (const rule of REDIRECTS) {
    if (rule.from.test(pathname)) {
      const target = rule.to(pathname);
      const url = new URL(target, request.url);
      return NextResponse.redirect(url, 301);
    }
  }

  const session = request.cookies.get("haiwave_session");

  // Protect /account/* routes
  if (pathname.startsWith("/account")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Protect /admin/* pages — require presence of a session cookie.
  // Role-level (is_admin) enforcement happens in the /admin page's server
  // component and in /api/admin/* route handlers, which verify the JWT
  // signature and realm_access roles via jose. This middleware runs on the
  // Edge runtime and only performs the cheap presence check.
  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // /api/admin/* routes perform their own session + is_admin check; they
  // are intentionally not covered by this matcher because the matcher runs
  // on the Edge runtime and cannot do the full JWKS verification.
  matcher: ["/account/:path*", "/admin/:path*"],
};
