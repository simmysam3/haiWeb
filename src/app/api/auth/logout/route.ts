import { NextRequest, NextResponse } from "next/server";
import { endSession } from "@/lib/keycloak";
import { loadEnv } from "@/config/env";

/**
 * POST /api/auth/logout
 *
 * Ends the Keycloak session, clears the session cookies, and redirects to
 * /login.
 *
 * POST-only by design. Logout mutates state, so it must NOT be reachable via
 * GET: Next's router prefetches visible <Link>s on navigation, and a GET
 * prefetch of a destructive logout route silently destroyed the session,
 * bouncing the user to re-login when merely moving between pages. The Sign Out
 * control is therefore a POST <form> (see components/account-nav.tsx), and the
 * old "convenience" GET handler has been removed.
 */
function clearCookies(response: NextResponse) {
  response.cookies.set("haiwave_session", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  response.cookies.set("haiwave_refresh", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("haiwave_refresh")?.value;

  if (refreshToken) {
    try {
      await endSession(refreshToken);
    } catch {
      // Best effort — still clear cookies + redirect.
    }
  }

  const baseUrl = loadEnv().PORTAL_BASE_URL;
  // 303 See Other so the browser converts the form POST into a GET on /login
  // (a 307/308 would re-POST to /login).
  const response = NextResponse.redirect(new URL("/login", baseUrl), 303);
  return clearCookies(response);
}
