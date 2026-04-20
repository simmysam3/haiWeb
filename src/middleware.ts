import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
