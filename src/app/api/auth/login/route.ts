import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/keycloak";

/**
 * POST /api/auth/login
 *
 * Authenticates via Keycloak. Falls back to mock session in dev.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  // Try Keycloak authentication
  try {
    const tokens = await authenticateUser(email, password);

    const response = NextResponse.json({ success: true });

    response.cookies.set("haiwave_session", tokens.access_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    });

    response.cookies.set("haiwave_refresh", tokens.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 86400, // 24 hours
      path: "/",
    });

    return response;
  } catch {
    // Dev fallback: if Keycloak unavailable, use mock cookie
    if (process.env.NODE_ENV === "development") {
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

    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }
}
