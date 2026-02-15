import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 * GET  /api/auth/logout (convenience for link-based logout)
 *
 * Deletes session cookie, returns success.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("haiwave_session", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}

export async function GET() {
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_URL || "http://localhost:3000"));
  response.cookies.set("haiwave_session", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
