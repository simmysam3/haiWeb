import { NextRequest, NextResponse } from "next/server";
import { endSession } from "@/lib/keycloak";

/**
 * POST /api/auth/logout
 * GET  /api/auth/logout (convenience for link-based logout)
 *
 * Ends Keycloak session, clears cookies.
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
      // Best effort — still clear cookies
    }
  }

  return clearCookies(NextResponse.json({ success: true }));
}

export async function GET(request: NextRequest) {
  const refreshToken = request.cookies.get("haiwave_refresh")?.value;

  if (refreshToken) {
    try {
      await endSession(refreshToken);
    } catch {
      // Best effort — still clear cookies + redirect.
    }
  }

  // Derive the redirect base from the inbound request so we stay on the
  // origin the user is browsing — HaiWeb dev runs on port 3001, so a hardcoded
  // localhost:3000 fallback bounced sign-outs to the haiCore API port instead
  // of the portal.
  const baseUrl = process.env.NEXT_PUBLIC_URL || request.url;
  const response = NextResponse.redirect(new URL("/login", baseUrl));
  return clearCookies(response);
}
