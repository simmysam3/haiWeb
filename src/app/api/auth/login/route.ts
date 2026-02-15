import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/login
 *
 * Mock: accepts any credentials. Sets session cookie.
 * Value = "admin" if email contains "admin", else "user".
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const isAdmin = email.toLowerCase().includes("admin");
  const response = NextResponse.json({ success: true });

  response.cookies.set("haiwave_session", isAdmin ? "admin" : "user", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1800, // 30 minutes
    path: "/",
  });

  return response;
}
