import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/register
 *
 * Mock: accepts any registration data, sets session cookie.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  const isAdmin = email.toLowerCase().includes("admin");
  const response = NextResponse.json({ success: true });

  response.cookies.set("haiwave_session", isAdmin ? "admin" : "user", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1800,
    path: "/",
  });

  return response;
}
